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
import type {
  CollapseFloorCandidate,
  GameInput,
  Platform,
  PlayerBody,
  Rect,
} from "@/game/types";

type GameStatus =
  | "playing"
  | "respawning"
  | "shattering"
  | "grave"
  | "complete";

type RuntimeObstacle = Rect & { direction: 1 | -1 };
type Viewport = {
  width: number;
  height: number;
  scale: number;
  groundScreenY: number;
};
type ShatterPiece = Rect & {
  velocityX: number;
  velocityY: number;
  targetX: number;
  targetY: number;
  settled: boolean;
};
type ShatterState = {
  phase: "falling" | "grave";
  pieces: ShatterPiece[];
  graveUntil: number;
};

const PLAYER_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Space",
  "KeyA",
  "KeyD",
]);

const GRAVE_LAYOUT = [
  { x: -12, y: 0 },
  { x: -4, y: 0 },
  { x: 4, y: 0 },
  { x: 12, y: 0 },
  { x: -8, y: -6 },
  { x: 0, y: -6 },
  { x: 8, y: -6 },
  { x: -4, y: -12 },
  { x: 4, y: -12 },
  { x: 0, y: -18 },
] as const;

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

function pickCollapseFloor() {
  const index = Math.floor(
    Math.random() * STAGE_1.collapseFloorCandidates.length,
  );
  return { candidate: STAGE_1.collapseFloorCandidates[index], index };
}

function createGroundSurfaces(
  candidate: CollapseFloorCandidate,
  collapsed: boolean,
) {
  let collapseSurface: Platform | null = null;
  const groundSurfaces: Platform[] = [];

  for (const ground of STAGE_1.ground) {
    const candidateEnd = candidate.x + candidate.width;
    const groundEnd = ground.x + ground.width;
    const containsCandidate =
      candidate.x >= ground.x && candidateEnd <= groundEnd;

    if (!containsCandidate) {
      groundSurfaces.push({ ...ground });
      continue;
    }
    if (candidate.x > ground.x) {
      groundSurfaces.push({ ...ground, width: candidate.x - ground.x });
    }
    if (!collapsed) {
      collapseSurface = {
        type: "ground",
        x: candidate.x,
        y: ground.y,
        width: candidate.width,
        height: ground.height,
      };
      groundSurfaces.push(collapseSurface);
    }
    if (candidateEnd < groundEnd) {
      groundSurfaces.push({
        ...ground,
        x: candidateEnd,
        width: groundEnd - candidateEnd,
      });
    }
  }

  return { collapseSurface, groundSurfaces };
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
    let deathMode: "none" | "normal" | "shatter" = "none";
    let isOverjumping = false;
    let overjumpCount = 0;
    let breakHeadCount = 0;
    let goalLandingCount = 0;
    let shatterState: ShatterState | null = null;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
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
    let collapseSelection = pickCollapseFloor();
    let collapseCollapsed = false;
    let { collapseSurface, groundSurfaces } = createGroundSurfaces(
      collapseSelection.candidate,
      collapseCollapsed,
    );
    const goalSurface: Platform = {
      type: "platform",
      x: STAGE_1.goal.x,
      y: STAGE_1.goal.y,
      width: STAGE_1.goal.width,
      height: STAGE_1.goal.height,
    };

    const collisionSurfaces = () => [
      ...groundSurfaces,
      ...STAGE_1.platforms,
    ];

    const clearInput = () => {
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jumpHeld = false;
      inputRef.current.jumpBuffer = 0;
    };

    const resetCollapseFloor = () => {
      collapseSelection = pickCollapseFloor();
      collapseCollapsed = false;
      ({ collapseSurface, groundSurfaces } = createGroundSurfaces(
        collapseSelection.candidate,
        collapseCollapsed,
      ));
    };

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
      cameraX = clamp(
        cameraX,
        0,
        Math.max(0, STAGE_1.length - visibleWorldWidth),
      );
    };

    const resetRuntime = () => {
      player = freshPlayer();
      cameraX = 0;
      obstacle = { ...STAGE_1.obstacles[0], direction: 1 };
      respawnAt = 0;
      deathMode = "none";
      isOverjumping = false;
      shatterState = null;
      clearInput();
      resetCollapseFloor();
      setStatus("playing");
      setAnnouncement("다시 시작합니다.");
    };

    const failPlayer = (now: number) => {
      if (respawnAt || shatterState || gameComplete) return;
      deathCount += 1;
      deathMode = "normal";
      respawnAt = now + GAME_CONFIG.respawnDelay;
      player.velocityX = 0;
      player.velocityY = 0;
      clearInput();
      setStatus("respawning");
      setAnnouncement("실패했습니다. 시작점으로 돌아갑니다.");
    };

    const graveBaseAt = (x: number, y: number) => {
      const candidates = [...collisionSurfaces(), goalSurface]
        .filter(
          (surface) =>
            surface.y >= y &&
            x >= surface.x - 30 &&
            x <= surface.x + surface.width + 30,
        )
        .sort((a, b) => a.y - b.y);
      return candidates[0]?.y ?? STAGE_1.groundY;
    };

    const triggerShatterDeath = (now: number, x: number, y: number) => {
      if (respawnAt || shatterState || gameComplete) return;

      deathCount += 1;
      deathMode = "shatter";
      isOverjumping = false;
      clearInput();
      const baseY = graveBaseAt(x, y);
      const pieces: ShatterPiece[] = Array.from(
        { length: GAME_CONFIG.shatter.pieceCount },
        (_, index) => {
          const layout = GRAVE_LAYOUT[index % GRAVE_LAYOUT.length];
          const size =
            GAME_CONFIG.shatter.pieceSizeMin +
            Math.random() *
              (GAME_CONFIG.shatter.pieceSizeMax -
                GAME_CONFIG.shatter.pieceSizeMin);
          const targetX = clamp(
            x + layout.x - size / 2,
            0,
            STAGE_1.length - size,
          );
          const targetY = baseY + layout.y - size;

          return {
            x: reducedMotion ? targetX : x - size / 2,
            y: reducedMotion ? targetY : y - size / 2,
            width: size,
            height: size,
            velocityX: reducedMotion
              ? 0
              : (Math.random() * 2 - 1) *
                GAME_CONFIG.shatter.horizontalSpread,
            velocityY: reducedMotion
              ? 0
              : -Math.random() * GAME_CONFIG.shatter.upwardVelocity,
            targetX,
            targetY,
            settled: reducedMotion,
          };
        },
      );

      shatterState = { phase: "falling", pieces, graveUntil: 0 };
      player.velocityX = 0;
      player.velocityY = 0;
      setStatus("shattering");
      setAnnouncement("잠시 후 다시 시작합니다.");
    };

    const updateShatter = (delta: number, now: number) => {
      if (!shatterState) return;

      if (shatterState.phase === "grave") {
        if (now >= shatterState.graveUntil) resetRuntime();
        return;
      }

      for (const piece of shatterState.pieces) {
        if (piece.settled) continue;
        piece.velocityY += GAME_CONFIG.shatter.gravity * delta;
        piece.x += piece.velocityX * delta;
        piece.y += piece.velocityY * delta;
        if (piece.y >= piece.targetY) {
          piece.x = piece.targetX;
          piece.y = piece.targetY;
          piece.velocityX = 0;
          piece.velocityY = 0;
          piece.settled = true;
        }
      }

      if (shatterState.pieces.every((piece) => piece.settled)) {
        shatterState.phase = "grave";
        shatterState.graveUntil =
          now +
          (reducedMotion
            ? GAME_CONFIG.shatter.reducedMotionGraveDisplayDuration
            : GAME_CONFIG.shatter.graveDisplayDuration);
        setStatus("grave");
      }
    };

    const finishGame = () => {
      if (gameComplete || shatterState || respawnAt) return;
      gameComplete = true;
      goalLandingCount += 1;
      player.velocityX = 0;
      player.velocityY = 0;
      clearInput();
      setStatus("complete");
      setAnnouncement("EXIT에 착지했습니다. Meme Archive로 이동합니다.");
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

    const isInOverjumpZone = () => {
      const zone = STAGE_1.overjump.triggerZone;
      return player.x + player.width > zone.x && player.x < zone.x + zone.width;
    };

    const headCollision = (nextY: number) => {
      if (player.velocityY >= 0) return null;
      return (
        STAGE_1.platforms.find((platform) => {
          const platformBottom = platform.y + platform.height;
          return (
            player.y >= platformBottom - 2 &&
            nextY <= platformBottom &&
            player.x + player.width > platform.x + 2 &&
            player.x < platform.x + platform.width - 2
          );
        }) ?? null
      );
    };

    const resolveGoalSideCollision = (previousX: number, nextX: number) => {
      const goalRight = STAGE_1.goal.x + STAGE_1.goal.width;
      const playerBottom = player.y + player.height;
      const verticallyInsideGoal =
        player.y < STAGE_1.goal.y + STAGE_1.goal.height &&
        playerBottom > STAGE_1.goal.y + 2;

      if (!verticallyInsideGoal) return nextX;
      if (
        player.velocityX > 0 &&
        previousX + player.width <= STAGE_1.goal.x &&
        nextX + player.width > STAGE_1.goal.x
      ) {
        player.velocityX = 0;
        return STAGE_1.goal.x - player.width;
      }
      if (
        player.velocityX < 0 &&
        previousX >= goalRight &&
        nextX < goalRight
      ) {
        player.velocityX = 0;
        return goalRight;
      }
      return nextX;
    };

    const updatePlayer = (delta: number, now: number) => {
      if (shatterState) {
        updateShatter(delta, now);
        return;
      }
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
      const controlScale = isOverjumping
        ? GAME_CONFIG.overjump.horizontalControl
        : 1;
      const targetVelocity =
        direction * GAME_CONFIG.player.moveSpeed * controlScale;
      const acceleration =
        (player.onGround
          ? GAME_CONFIG.player.groundAcceleration
          : GAME_CONFIG.player.airAcceleration) * controlScale;
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
        if (isInOverjumpZone()) {
          isOverjumping = true;
          overjumpCount += 1;
          player.velocityY = -GAME_CONFIG.overjump.launchVelocity;
        } else {
          player.velocityY = -GAME_CONFIG.player.jumpVelocity;
        }
      }

      const previousBottom = player.y + player.height;
      const previousX = player.x;
      const maximumPlayerX = STAGE_1.length - player.width;
      const rawNextX = player.x + player.velocityX * delta;
      player.x = clamp(
        resolveGoalSideCollision(previousX, rawNextX),
        0,
        maximumPlayerX,
      );

      if (
        isOverjumping &&
        rawNextX >= maximumPlayerX &&
        player.velocityX > 0
      ) {
        triggerShatterDeath(
          now,
          maximumPlayerX + player.width / 2,
          player.y + player.height / 2,
        );
        return;
      }

      const nextVelocityY =
        player.velocityY + GAME_CONFIG.player.gravity * delta;
      player.velocityY =
        isOverjumping && nextVelocityY > 0
          ? Math.min(nextVelocityY, GAME_CONFIG.overjump.fallSpeed)
          : Math.min(nextVelocityY, GAME_CONFIG.player.maxFallSpeed);
      const nextY = player.y + player.velocityY * delta;

      if (headCollision(nextY)) {
        breakHeadCount += 1;
        triggerShatterDeath(
          now,
          player.x + player.width / 2,
          player.y + player.height / 2,
        );
        return;
      }

      const nextBottom = nextY + player.height;
      const landing =
        player.velocityY >= 0
          ? findLandingSurface(
              previousBottom,
              nextBottom,
              player.x,
              player.width,
              [...collisionSurfaces(), goalSurface],
            )
          : null;

      if (landing === collapseSurface) {
        collapseCollapsed = true;
        ({ collapseSurface, groundSurfaces } = createGroundSurfaces(
          collapseSelection.candidate,
          collapseCollapsed,
        ));
        player.y = nextY;
        player.onGround = false;
        player.coyoteTime = Math.max(
          player.coyoteTime,
          GAME_CONFIG.player.collapseCoyoteTime,
        );
      } else if (landing) {
        player.y = landing.y - player.height;
        player.velocityY = 0;
        player.onGround = true;
        isOverjumping = false;
        if (landing === goalSurface) {
          finishGame();
          return;
        }
      } else {
        player.y = nextY;
        player.onGround = false;
      }

      if (player.y > STAGE_1.deathY || rectanglesOverlap(player, obstacle)) {
        failPlayer(now);
      }
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

      for (const ground of groundSurfaces) {
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
      context.lineTo(
        obstacle.x + obstacle.width - 8,
        obstacle.y + obstacle.height - 8,
      );
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

      if (shatterState) {
        for (const piece of shatterState.pieces) {
          context.fillRect(piece.x, piece.y, piece.width, piece.height);
        }
      } else if (!respawnAt) {
        context.fillRect(player.x, player.y, player.width, player.height);
      }
      context.restore();

      const playerScreenY = verticalOffset + player.y * viewport.scale;
      const indicatorVisible =
        isOverjumping && !shatterState && playerScreenY < 0;
      if (indicatorVisible) {
        const playerScreenX =
          (player.x - cameraX + player.width / 2) * viewport.scale;
        context.fillStyle = "#fff";
        context.font = "700 22px Arial";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(
          "↑",
          clamp(playerScreenX, 14, viewport.width - 14),
          GAME_CONFIG.overjump.indicatorMargin,
        );
      }

      canvas.dataset.playerX = Math.round(player.x).toString();
      canvas.dataset.playerY = Math.round(player.y).toString();
      canvas.dataset.playerVelocityY = Math.round(player.velocityY).toString();
      canvas.dataset.cameraX = Math.round(cameraX).toString();
      canvas.dataset.obstacleX = Math.round(obstacle.x).toString();
      canvas.dataset.deathCount = deathCount.toString();
      canvas.dataset.deathMode = deathMode;
      canvas.dataset.collapseIndex = collapseSelection.index.toString();
      canvas.dataset.collapseX = collapseSelection.candidate.x.toString();
      canvas.dataset.collapseCandidateCount =
        STAGE_1.collapseFloorCandidates.length.toString();
      canvas.dataset.collapseCollapsed = collapseCollapsed.toString();
      canvas.dataset.breakHeadCount = breakHeadCount.toString();
      canvas.dataset.overjump = isOverjumping.toString();
      canvas.dataset.overjumpCount = overjumpCount.toString();
      canvas.dataset.indicatorVisible = indicatorVisible.toString();
      canvas.dataset.shatterPieceCount =
        shatterState?.pieces.length.toString() ?? "0";
      canvas.dataset.gravePieceCount =
        shatterState?.pieces
          .filter((piece) => piece.settled)
          .length.toString() ?? "0";
      canvas.dataset.goalLandingCount = goalLandingCount.toString();
      canvas.dataset.reducedMotion = reducedMotion.toString();
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
      clearInput();
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
