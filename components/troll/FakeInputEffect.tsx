"use client";

import { useEffect, useRef, useState } from "react";
import type { CompositionEventHandler, KeyboardEventHandler } from "react";

type FakeInputEffectProps = {
  onComplete: () => void;
};

export function FakeInputEffect({
  onComplete,
}: FakeInputEffectProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, []);

  const handleCompositionStart: CompositionEventHandler<HTMLInputElement> =
    () => {
      isComposingRef.current = true;
    };

  const handleCompositionEnd: CompositionEventHandler<HTMLInputElement> = (
    event,
  ) => {
    isComposingRef.current = false;
    setValue(event.currentTarget.value.slice(0, 1));
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    const nativeEvent = event.nativeEvent;
    if (
      event.key !== "Enter" ||
      nativeEvent.isComposing ||
      isComposingRef.current ||
      event.keyCode === 229
    ) {
      return;
    }

    if (value === "입") {
      event.preventDefault();
      event.currentTarget.blur();
      onComplete();
    }
  };

  return (
    <section className="fake-input-effect" aria-labelledby="fake-input-label">
      <label id="fake-input-label" htmlFor="fake-entrance-input">
        입장하시려면 <strong>&apos;입장&apos;</strong>을 입력해주세요
      </label>
      <input
        ref={inputRef}
        id="fake-entrance-input"
        type="text"
        value={value}
        maxLength={1}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        onChange={(event) => setValue(event.currentTarget.value.slice(0, 1))}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        aria-describedby="entrance-status"
      />
    </section>
  );
}
