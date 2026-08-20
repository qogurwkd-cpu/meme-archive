"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileControls } from "./MobileControls";
import { GAME_CONFIG } from "@/game/gameConfig";
import {
  clamp,
  findLandingSurface,
  moveToward,
  rectanglesOverlap,
} from "@/game/engine/geometry";
import { STAGE_1 } from "@/game/stage1";
import type { GameInput, PlayerBody, Rect } from "@/game/types";

type GameStatus = "playing" | "respawning" | "complete";

type RuntimeObstacle = Rect & {
  direction: 1 | -1;
};

type Viewport = {
  width: number;
  height: number;
  scale: number;
  groundScreenY: number;
};

const PLAYER_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Space",
  "KeyA",
  "KeyD",
]);

function freshPlayer(): PlayerBody {
  return {
    x: STAGE_1.start.x,
    y: STAGE_1.start.y,
    width: GAME_CONFIG.player.width,
    height: GAME_CONFIG.player.height,
    velocityX: 0,
    velocityY: 0,
    onGround: true,
    coyoteTime: GAME_CONFIG.player.coyoteTime,
  };
}

export function MiniGame() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<GameInput>({
    left: false,
    right: false,
    jumpHeld: false,
    jumpBuffer: 0,
  });
  const [status, setStatus] = useState<GameStatus>("playing");
  const [announcement, setAnnouncement] = useState(
    "화살표 키로 이동하고 Space 키로 점프하세요.",
  );

  const handleMove = useCallback(
    (direction: "left" | "right", pressed: boolean) => {
      inputRef.current[direction] = pressed;
    },
    [],
  );

  const handleJump = useCallback((pressed: boolean) => {
    if (pressed && !inputRef.current.jumpHeld) {
      inputRef.current.jumpBuffer = GAME_CONFIG.player.jumpBufferTime;
    }
    inputRef.current.jumpHeld = pressed;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let player = freshPlayer();
    let cameraX = 0;
    let lastFrameTime = performance.now();
    let respawnAt = 0;
    let gameComplete = false;
    let isPaused = document.hidden;
    let deathCount = 0;
    let lastDebugBucket = -1;
    let lastDebugYBucket = -1;
    const keyboardReleaseTimers: {
      left: ReturnType<typeof setTimeout> | null;
      right: ReturnType<typeof setTimeout> | null;
    } = { left: null, right: null };
    let obstacle: RuntimeObstacle = {
      ...STAGE_1.obstacles[0],
      direction: 1,
    };
    let viewport: Viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: 1,
      groundScreenY: window.innerHeight * 0.72,
    };
    const surfaces = [...STAGE_1.ground, ...STAGE_1.platforms];

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        GAME_CONFIG.maxDevicePixelRatio,
      );
      canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
      const scale = clamp(
        rect.width / 1_100,
        GAME_CONFIG.minRenderScale,
        GAME_CONFIG.maxRenderScale,
      );
      viewport = {
        width: rect.width,
        height: rect.height,
        scale,
        groundScreenY: clamp(rect.height * 0.72, 260, rect.height - 70),
      };
      const visibleWorldWidth = viewport.width / viewport.scale;
      cameraX = clamp(cameraX, 0, Math.max(0, STAGE_1.length - visibleWorldWidth));
    };

    const resetRuntime = () => {
      player = freshPlayer();
      cameraX = 0;
      obstacle = { ...STAGE_1.obstacles[0], direction: 1 };
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jumpHeld = false;
      inputRef.current.jumpBuffer = 0;
      respawnAt = 0;
      setStatus("playing");
      setAnnouncement("다시 시작합니다.");
    };

    const failPlayer = (now: number) => {
      if (respawnAt || gameComplete) return;
      deathCount += 1;
      respawnAt = now + GAME_CONFIG.respawnDelay;
      player.velocityX = 0;
      player.velocityY = 0;
      setStatus("respawning");
      setAnnouncement("실패했습니다. 시작점으로 돌아갑니다.");
    };

    const finishGame = () => {
      if (gameComplete) return;
      gameComplete = true;
      player.velocityX = 0;
      player.velocityY = 0;
      setStatus("complete");
      setAnnouncement("EXIT에 도달했습니다. Meme Archive로 이동합니다.");
      completionTimerRef.current = setTimeout(() => {
        const pagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        if (pagesBasePath) {
          window.location.assign(`${pagesBasePath}/memes/`);
        } else {
          router.push("/memes");
        }
      }, GAME_CONFIG.goalDelay);
    };

    const updateObstacle = (delta: number) => {
      obstacle.x += STAGE_1.obstacles[0].speed * obstacle.direction * delta;
      if (obstacle.x >= STAGE_1.obstacles[0].maxX) {
        obstacle.x = STAGE_1.obstacles[0].maxX;
        obstacle.direction = -1;
      } else if (obstacle.x <= STAGE_1.obstacles[0].minX) {
        obstacle.x = STAGE_1.obstacles[0].minX;
        obstacle.direction = 1;
      }
    };

    const updatePlayer = (delta: number, now: number) => {
      if (respawnAt) {
        if (now >= respawnAt) resetRuntime();
        return;
      }
      if (gameComplete) return;

      const input = inputRef.current;
      input.jumpBuffer = Math.max(0, input.jumpBuffer - delta);
      player.coyoteTime = player.onGround
        ? GAME_CONFIG.player.coyoteTime
        : Math.max(0, player.coyoteTime - delta);

      const direction = Number(input.right) - Number(input.left);
      const targetVelocity = direction * GAME_CONFIG.player.moveSpeed;
      const acceleration = player.onGround
        ? GAME_CONFIG.player.groundAcceleration
        : GAME_CONFIG.player.airAcceleration;
      if (direction) {
        player.velocityX = moveToward(
          player.velocityX,
          targetVelocity,
          acceleration * delta,
        );
      } else if (player.onGround) {
        player.velocityX = moveToward(
          player.velocityX,
          0,
          GAME_CONFIG.player.groundFriction * delta,
        );
      }

      if (input.jumpBuffer > 0 && player.coyoteTime > 0) {
        input.jumpBuffer = 0;
        player.coyoteTime = 0;
        player.onGround = false;
        player.velocityY = -GAME_CONFIG.player.jumpVelocity;
      }

      const previousBottom = player.y + player.height;
      player.x = clamp(
        player.x + player.velocityX * delta,
        0,
        STAGE_1.length - player.width,
      );
      player.velocityY = Math.min(
        player.velocityY + GAME_CONFIG.player.gravity * delta,
        GAME_CONFIG.player.maxFallSpeed,
      );
      const nextY = player.y + player.velocityY * delta;
      const nextBottom = nextY + player.height;
      const landing =
        player.velocityY >= 0
          ? findLandingSurface(
              previousBottom,
              nextBottom,
              player.x,
              player.width,
              surfaces,
            )
          : null;

      if (landing) {
        player.y = landing.y - player.height;
        player.velocityY = 0;
        player.onGround = true;
      } else {
        player.y = nextY;
        player.onGround = false;
      }

      if (player.y > STAGE_1.deathY || rectanglesOverlap(player, obstacle)) {
        failPlayer(now);
        return;
      }
      if (rectanglesOverlap(player, STAGE_1.goal)) finishGame();
    };

    const updateCamera = (delta: number) => {
      const visibleWorldWidth = viewport.width / viewport.scale;
      const maxCameraX = Math.max(0, STAGE_1.length - visibleWorldWidth);
      const target = clamp(
        player.x - visibleWorldWidth * GAME_CONFIG.cameraOffset,
        0,
        maxCameraX,
      );
      cameraX +=
        (target - cameraX) * Math.min(1, delta * GAME_CONFIG.cameraSmoothing);
      cameraX = clamp(cameraX, 0, maxCameraX);
    };

    const render = () => {
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        GAME_CONFIG.maxDevicePixelRatio,
      );
      const verticalOffset =
        viewport.groundScreenY - STAGE_1.groundY * viewport.scale;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.fillStyle = "#000";
      context.fillRect(0, 0, viewport.width, viewport.height);
      context.save();
      context.translate(-cameraX * viewport.scale, verticalOffset);
      context.scale(viewport.scale, viewport.scale);
      context.fillStyle = "#fff";

      for (const ground of STAGE_1.ground) {
        context.fillRect(ground.x, ground.y, ground.width, ground.height);
      }
      for (const platform of STAGE_1.platforms) {
        context.fillRect(platform.x, platform.y, platform.width, platform.height);
      }

      context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      context.strokeStyle = "#000";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(obstacle.x + 8, obstacle.y + 8);
      context.lineTo(obstacle.x + obstacle.width - 8, obstacle.y + obstacle.height - 8);
      context.moveTo(obstacle.x + obstacle.width - 8, obstacle.y + 8);
      context.lineTo(obstacle.x + 8, obstacle.y + obstacle.height - 8);
      context.stroke();

      context.strokeStyle = "#fff";
      context.lineWidth = 3;
      context.strokeRect(
        STAGE_1.goal.x,
        STAGE_1.goal.y,
        STAGE_1.goal.width,
        STAGE_1.goal.height,
      );
      context.fillStyle = "#fff";
      context.font = "700 13px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        STAGE_1.goal.label,
        STAGE_1.goal.x + STAGE_1.goal.width / 2,
        STAGE_1.goal.y + STAGE_1.goal.height / 2,
      );

      if (!respawnAt) {
        context.fillRect(player.x, player.y, player.width, player.height);
      }
      context.restore();

      const debugBucket = Math.floor(player.x / 25);
      const debugYBucket = Math.floor(player.y / 25);
      if (
        debugBucket !== lastDebugBucket ||
        debugYBucket !== lastDebugYBucket ||
        respawnAt ||
        gameComplete
      ) {
        lastDebugBucket = debugBucket;
        lastDebugYBucket = debugYBucket;
        canvas.dataset.playerX = Math.round(player.x).toString();
        canvas.dataset.playerY = Math.round(player.y).toString();
        canvas.dataset.cameraX = Math.round(cameraX).toString();
        canvas.dataset.obstacleX = Math.round(obstacle.x).toString();
        canvas.dataset.deathCount = deathCount.toString();
      }
    };

    const frame = (now: number) => {
      const delta = Math.min(
        Math.max(0, (now - lastFrameTime) / 1_000),
        GAME_CONFIG.maxDeltaTime,
      );
      lastFrameTime = now;
      if (!isPaused) {
        updateObstacle(delta);
        updatePlayer(delta, now);
        updateCamera(delta);
      }
      render();
      frameRef.current = requestAnimationFrame(frame);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!PLAYER_KEYS.has(event.code)) return;
      event.preventDefault();
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        if (keyboardReleaseTimers.left) {
          clearTimeout(keyboardReleaseTimers.left);
          keyboardReleaseTimers.left = null;
        }
        inputRef.current.left = true;
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        if (keyboardReleaseTimers.right) {
          clearTimeout(keyboardReleaseTimers.right);
          keyboardReleaseTimers.right = null;
        }
        inputRef.current.right = true;
      } else {
        if (!event.repeat && !inputRef.current.jumpHeld) {
          inputRef.current.jumpBuffer = GAME_CONFIG.player.jumpBufferTime;
        }
        inputRef.current.jumpHeld = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!PLAYER_KEYS.has(event.code)) return;
      event.preventDefault();
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        keyboardReleaseTimers.left = setTimeout(() => {
          inputRef.current.left = false;
          keyboardReleaseTimers.left = null;
        }, 50);
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        keyboardReleaseTimers.right = setTimeout(() => {
          inputRef.current.right = false;
          keyboardReleaseTimers.right = null;
        }, 50);
      } else {
        inputRef.current.jumpHeld = false;
      }
    };

    const handleVisibility = () => {
      isPaused = document.hidden;
      lastFrameTime = performance.now();
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jumpHeld = false;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    document.addEventListener("visibilitychange", handleVisibility);
    frameRef.current = requestAnimationFrame(frame);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      if (keyboardReleaseTimers.left) clearTimeout(keyboardReleaseTimers.left);
      if (keyboardReleaseTimers.right) clearTimeout(keyboardReleaseTimers.right);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  return (
    <main className="game-shell" data-game-status={status}>
      <p className="game-instructions">← → / A D 이동 · Space / ↑ 점프</p>
      <p id="game-description" className="sr-only">
        흰색 사각형을 움직여 구덩이와 움직이는 장애물을 피하고 EXIT에
        도달하세요.
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        role="img"
        aria-label="플랫폼 게임 화면"
        aria-describedby="game-description"
      />
      <MobileControls onMove={handleMove} onJump={handleJump} />
    </main>
  );
}
