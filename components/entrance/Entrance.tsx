"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EntranceButton } from "@/components/troll/EntranceButton";
import { FakeButtonEffect } from "@/components/troll/FakeButtonEffect";
import { FakeInputEffect } from "@/components/troll/FakeInputEffect";
import { EFFECT_MESSAGES } from "@/components/troll/trollConfig";
import {
  clampPosition,
  distantPosition,
  runawayStepPosition,
  scatteredButtonPositions,
} from "@/components/troll/position";
import type {
  FakeButtonState,
  Point,
  TrollEffect,
  TrollRoundStart,
} from "@/components/troll/types";
import { useTrollEngine } from "@/hooks/useTrollEngine";

const PROXIMITY_DISTANCE = 92;
const RUNAWAY_STEP_COOLDOWN = 115;
const RUNAWAY_DURATION = 1_800;
const TELEPORT_DURATION = 1_050;
const TEXT_DURATION = 1_200;
const PRIMARY_FADE_DURATION = 200;
const FAKE_BUTTON_FADE_DURATION = 210;
const FAKE_REAL_SETTLE_DURATION = 280;
const SHRINK_RECLICK_GUARD = 280;

export function Entrance() {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<number | null>(null);
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRoundIdRef = useRef<number | null>(null);
  const currentEffectRef = useRef<TrollEffect | null>(null);
  const entranceReadyRef = useRef(false);
  const enteringRef = useRef(false);
  const lastRunawayStepRef = useRef(0);
  const roundStartedAtRef = useRef(0);
  const fakeRoundCompletingRef = useRef(false);
  const fakeButtonsRef = useRef<FakeButtonState[]>([]);
  const fakeRemovalTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set(),
  );
  const buttonSizeRef = useRef({ width: 0, height: 0 });
  const [position, setPosition] = useState<Point | null>(null);
  const [scale, setScale] = useState(1);
  const [fakeButtons, setFakeButtons] = useState<FakeButtonState[]>([]);
  const [primaryButtonVisible, setPrimaryButtonVisible] = useState(true);
  const [primaryButtonFading, setPrimaryButtonFading] = useState(false);
  const [showFakeInput, setShowFakeInput] = useState(false);
  const [message, setMessage] = useState(
    "문을 열고 싶다면 들어오세요.",
  );
  const [entering, setEntering] = useState(false);
  const engine = useTrollEngine();
  const { completeRound, startRound } = engine;

  const clearRoundTimer = useCallback(() => {
    if (roundTimerRef.current) {
      clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }
  }, []);

  const clearFakeRemovalTimers = useCallback(() => {
    fakeRemovalTimersRef.current.forEach((timer) => clearTimeout(timer));
    fakeRemovalTimersRef.current.clear();
  }, []);

  const updateFakeButtons = useCallback((buttons: FakeButtonState[]) => {
    fakeButtonsRef.current = buttons;
    setFakeButtons(buttons);
  }, []);

  const finishRound = useCallback(
    (roundId: number) => {
      clearRoundTimer();
      const result = completeRound(roundId);
      if (!result.completed) return;

      activeRoundIdRef.current = null;
      currentEffectRef.current = null;
      fakeRoundCompletingRef.current = false;
      clearFakeRemovalTimers();
      setScale(1);
      updateFakeButtons([]);
      setShowFakeInput(false);
      setPrimaryButtonFading(false);
      setPrimaryButtonVisible(true);

      if (result.entranceReady) {
        entranceReadyRef.current = true;
        setMessage("좋아요. 이제 진짜 입장입니다.");
        setPosition(null);
      } else {
        setMessage("한 번은 넘겼습니다. 아직 끝은 아니에요.");
      }
    },
    [
      clearFakeRemovalTimers,
      clearRoundTimer,
      completeRound,
      updateFakeButtons,
    ],
  );

  const scheduleRoundFinish = useCallback(
    (roundId: number, delay: number) => {
      clearRoundTimer();
      roundTimerRef.current = setTimeout(() => finishRound(roundId), delay);
    },
    [clearRoundTimer, finishRound],
  );

  const beginRound = useCallback(
    (pointer?: Point) => {
      if (enteringRef.current || entranceReadyRef.current) return;
      const round: TrollRoundStart | null = startRound();
      if (!round) return;

      activeRoundIdRef.current = round.id;
      currentEffectRef.current = round.effect;
      roundStartedAtRef.current = performance.now();
      fakeRoundCompletingRef.current = false;
      clearFakeRemovalTimers();
      setScale(1);
      updateFakeButtons([]);
      setShowFakeInput(false);
      setPrimaryButtonVisible(true);
      setPrimaryButtonFading(false);
      setMessage(EFFECT_MESSAGES[round.effect]);

      const button = buttonRef.current;
      if (!button) {
        scheduleRoundFinish(round.id, TEXT_DURATION);
        return;
      }
      const rect = button.getBoundingClientRect();
      buttonSizeRef.current = {
        width: button.offsetWidth,
        height: button.offsetHeight,
      };

      switch (round.effect) {
        case "runaway": {
          const origin = pointer ?? {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          setPosition(runawayStepPosition(origin, rect));
          lastRunawayStepRef.current = performance.now();
          scheduleRoundFinish(round.id, RUNAWAY_DURATION);
          break;
        }
        case "shrink":
          setScale(0.3);
          break;
        case "teleport": {
          const origin = pointer ?? {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          setPosition(
            distantPosition(button.offsetWidth, button.offsetHeight, origin),
          );
          scheduleRoundFinish(round.id, TELEPORT_DURATION);
          break;
        }
        case "fake": {
          setPrimaryButtonFading(true);
          clearRoundTimer();
          roundTimerRef.current = setTimeout(() => {
            if (
              activeRoundIdRef.current !== round.id ||
              currentEffectRef.current !== "fake"
            ) {
              return;
            }
            const positions = scatteredButtonPositions(
              buttonSizeRef.current.width,
              buttonSizeRef.current.height,
            );
            const realButtonIndex = Math.floor(
              Math.random() * positions.length,
            );
            setPrimaryButtonVisible(false);
            setPrimaryButtonFading(false);
            updateFakeButtons(
              positions.map((buttonPosition, index) => ({
                id: round.id * 10 + index,
                position: buttonPosition,
                isReal: index === realButtonIndex,
                isFading: false,
              })),
            );
          }, PRIMARY_FADE_DURATION);
          break;
        }
        case "text":
          scheduleRoundFinish(round.id, TEXT_DURATION);
          break;
        case "input":
          setPrimaryButtonFading(true);
          clearRoundTimer();
          roundTimerRef.current = setTimeout(() => {
            if (
              activeRoundIdRef.current !== round.id ||
              currentEffectRef.current !== "input"
            ) {
              return;
            }
            setPrimaryButtonVisible(false);
            setPrimaryButtonFading(false);
            setShowFakeInput(true);
          }, PRIMARY_FADE_DURATION);
          break;
      }
    },
    [
      clearFakeRemovalTimers,
      clearRoundTimer,
      scheduleRoundFinish,
      startRound,
      updateFakeButtons,
    ],
  );

  const enterArchive = useCallback(() => {
    if (
      enteringRef.current ||
      !entranceReadyRef.current ||
      currentEffectRef.current !== null
    ) {
      return;
    }

    enteringRef.current = true;
    setEntering(true);
    setScale(1);
    updateFakeButtons([]);
    setShowFakeInput(false);
    setPrimaryButtonFading(false);
    setPrimaryButtonVisible(true);
    setMessage("드디어 문이 열렸네요.");
    clearRoundTimer();
    enterTimerRef.current = setTimeout(() => {
      const pagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      if (pagesBasePath) {
        window.location.assign(`${pagesBasePath}/game/`);
      } else {
        router.push("/game");
      }
    }, 620);
  }, [clearRoundTimer, router, updateFakeButtons]);

  const handlePrimaryInput = useCallback(
    (pointer?: Point) => {
      if (enteringRef.current) return;

      const activeEffect = currentEffectRef.current;
      const activeRoundId = activeRoundIdRef.current;
      if (activeEffect && activeRoundId !== null) {
        if (activeEffect === "shrink") {
          if (
            performance.now() - roundStartedAtRef.current <
            SHRINK_RECLICK_GUARD
          ) {
            setMessage("조금 더 작아진 버튼을 다시 눌러보세요.");
            return;
          }
          setScale(1);
          finishRound(activeRoundId);
        } else if (activeEffect === "runaway" && pointer) {
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) setPosition(runawayStepPosition(pointer, rect));
          setMessage("잡힐 듯 말 듯, 아직은 아닙니다.");
        }
        return;
      }

      if (entranceReadyRef.current) {
        enterArchive();
        return;
      }

      beginRound(pointer);
    },
    [beginRound, enterArchive, finishRound],
  );

  const handleFakeButtonClick = useCallback(
    (id: number) => {
      const activeRoundId = activeRoundIdRef.current;
      if (
        currentEffectRef.current !== "fake" ||
        activeRoundId === null
      ) {
        return;
      }

      const selected = fakeButtonsRef.current.find(
        (button) => button.id === id,
      );
      if (!selected || selected.isFading) return;

      if (selected.isReal) {
        if (fakeRoundCompletingRef.current) return;
        fakeRoundCompletingRef.current = true;
        setMessage("찾았습니다. 이 라운드는 통과예요.");
        updateFakeButtons(
          fakeButtonsRef.current.map((button) => ({
            ...button,
            isFading: true,
          })),
        );
        scheduleRoundFinish(activeRoundId, FAKE_REAL_SETTLE_DURATION);
        return;
      }

      setMessage("가짜였습니다. 남은 버튼에서 다시 찾아보세요.");
      updateFakeButtons(
        fakeButtonsRef.current.map((button) =>
          button.id === id ? { ...button, isFading: true } : button,
        ),
      );
      const removalTimer = setTimeout(() => {
        fakeRemovalTimersRef.current.delete(removalTimer);
        if (
          currentEffectRef.current !== "fake" ||
          activeRoundIdRef.current !== activeRoundId
        ) {
          return;
        }
        updateFakeButtons(
          fakeButtonsRef.current.filter((button) => button.id !== id),
        );
      }, FAKE_BUTTON_FADE_DURATION);
      fakeRemovalTimersRef.current.add(removalTimer);
    },
    [scheduleRoundFinish, updateFakeButtons],
  );

  const handleFakeInputComplete = useCallback(() => {
    const activeRoundId = activeRoundIdRef.current;
    if (
      currentEffectRef.current !== "input" ||
      activeRoundId === null
    ) {
      return;
    }
    setShowFakeInput(false);
    setMessage("정답은 한 글자면 충분했습니다.");
    finishRound(activeRoundId);
  }, [finishRound]);

  useEffect(() => {
    entranceReadyRef.current = engine.isReady;
  }, [engine.isReady]);

  useEffect(() => {
    const handleResize = () => {
      const button = buttonRef.current;
      const width = button?.offsetWidth ?? buttonSizeRef.current.width;
      const height = button?.offsetHeight ?? buttonSizeRef.current.height;
      if (!width || !height) return;
      buttonSizeRef.current = { width, height };

      if (primaryButtonVisible) {
        if (entranceReadyRef.current) {
          setPosition(null);
        } else {
          setPosition((current) =>
            current
              ? clampPosition(current, width, height)
              : null,
          );
        }
      }

      if (
        currentEffectRef.current === "fake" &&
        fakeButtonsRef.current.length > 0
      ) {
        const nextPositions = scatteredButtonPositions(
          width,
          height,
          fakeButtonsRef.current.length,
        );
        updateFakeButtons(
          fakeButtonsRef.current.map((fake, index) => ({
            ...fake,
            position: nextPositions[index],
          })),
        );
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [primaryButtonVisible, updateFakeButtons]);

  useEffect(() => {
    const finePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    );

    const handlePointerMove = (event: PointerEvent) => {
      if (!finePointer.matches || enteringRef.current || frameRef.current) {
        return;
      }

      const pointer = { x: event.clientX, y: event.clientY };
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;

        const dx = Math.max(rect.left - pointer.x, 0, pointer.x - rect.right);
        const dy = Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom);
        const isNear = Math.hypot(dx, dy) <= PROXIMITY_DISTANCE;
        if (!isNear) return;

        if (currentEffectRef.current === "runaway") {
          const now = performance.now();
          if (now - lastRunawayStepRef.current >= RUNAWAY_STEP_COOLDOWN) {
            lastRunawayStepRef.current = now;
            setPosition(runawayStepPosition(pointer, rect));
          }
          return;
        }

        if (
          currentEffectRef.current === null &&
          !entranceReadyRef.current
        ) {
          beginRound(pointer);
        }
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [beginRound]);

  useEffect(
    () => () => {
      clearRoundTimer();
      clearFakeRemovalTimers();
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [clearFakeRemovalTimers, clearRoundTimer],
  );

  const handlePointerDown: React.PointerEventHandler<HTMLButtonElement> = (
    event,
  ) => {
    const pointer = { x: event.clientX, y: event.clientY };
    if (event.pointerType !== "mouse") {
      event.preventDefault();
      handlePrimaryInput(pointer);
      return;
    }

    if (currentEffectRef.current === "runaway") {
      event.preventDefault();
      handlePrimaryInput(pointer);
    }
  };

  return (
    <main
      className={`entrance ${entering ? "is-entering" : ""}`}
      data-round-state={
        entering
          ? "entering"
          : engine.isReady
            ? "ready"
            : engine.isRoundActive
              ? "active"
              : "idle"
      }
      data-effect={engine.currentEffect ?? undefined}
    >
      <p id="entrance-status" className="sr-only" aria-live="polite">
        {entering ? "입장 중입니다." : message}
      </p>

      <FakeButtonEffect
        buttons={fakeButtons}
        onButtonClick={handleFakeButtonClick}
      />

      {showFakeInput ? (
        <FakeInputEffect onComplete={handleFakeInputComplete} />
      ) : null}

      {primaryButtonVisible ? (
        <EntranceButton
          ref={buttonRef}
          position={position}
          scale={scale}
          text={engine.isReady ? "입장하기" : engine.buttonText}
          entering={entering}
          isFading={primaryButtonFading}
          onClick={() => handlePrimaryInput()}
          onPointerDown={handlePointerDown}
        />
      ) : null}

    </main>
  );
}
