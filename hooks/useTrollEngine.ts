"use client";

import { useCallback, useRef, useState } from "react";
import {
  createTargetRoundCount,
  MAX_TROLL_ROUNDS,
  TROLL_EFFECTS,
  TROLL_TEXTS,
} from "@/components/troll/trollConfig";
import type {
  TrollEffect,
  TrollRoundCompletion,
  TrollRoundStart,
} from "@/components/troll/types";

type ActiveRound = { id: number; effect: TrollEffect };

export function useTrollEngine() {
  const [targetRoundCount] = useState(createTargetRoundCount);
  const [roundCount, setRoundCount] = useState(0);
  const [currentEffect, setCurrentEffect] = useState<TrollEffect | null>(null);
  const [buttonText, setButtonText] = useState("입장하기");
  const roundCountRef = useRef(0);
  const previousEffectRef = useRef<TrollEffect | null>(null);
  const activeRoundRef = useRef<ActiveRound | null>(null);
  const nextRoundIdRef = useRef(0);

  const startRound = useCallback((): TrollRoundStart | null => {
    if (
      activeRoundRef.current !== null ||
      roundCountRef.current >= targetRoundCount
    ) {
      return null;
    }

    const available = TROLL_EFFECTS.filter(
      (effect) => effect !== previousEffectRef.current,
    );
    const effect = available[Math.floor(Math.random() * available.length)];
    const nextText =
      effect === "fake" || effect === "input"
        ? "입장하기"
        : TROLL_TEXTS[Math.floor(Math.random() * TROLL_TEXTS.length)];
    const id = ++nextRoundIdRef.current;

    activeRoundRef.current = { id, effect };
    previousEffectRef.current = effect;
    setCurrentEffect(effect);
    setButtonText(nextText);

    return { id, effect, buttonText: nextText };
  }, [targetRoundCount]);

  const completeRound = useCallback(
    (roundId: number): TrollRoundCompletion => {
      const activeRound = activeRoundRef.current;
      if (!activeRound || activeRound.id !== roundId) {
        return {
          completed: false,
          entranceReady: roundCountRef.current >= targetRoundCount,
        };
      }

      activeRoundRef.current = null;
      const nextRoundCount = Math.min(
        roundCountRef.current + 1,
        targetRoundCount,
      );
      roundCountRef.current = nextRoundCount;
      setRoundCount(nextRoundCount);
      setCurrentEffect(null);

      const entranceReady = nextRoundCount >= targetRoundCount;
      if (entranceReady) setButtonText("입장하기");
      return { completed: true, entranceReady };
    },
    [targetRoundCount],
  );

  const isRoundActive = currentEffect !== null;
  const isReady =
    roundCount >= targetRoundCount &&
    !isRoundActive;

  return {
    startRound,
    completeRound,
    roundCount,
    targetRoundCount,
    currentEffect,
    buttonText,
    isRoundActive,
    isReady,
    maxRoundSlots: MAX_TROLL_ROUNDS,
  };
}
