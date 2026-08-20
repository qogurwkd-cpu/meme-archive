"use client";

import { forwardRef } from "react";
import type {
  CSSProperties,
  MouseEventHandler,
  PointerEventHandler,
} from "react";
import type { Point } from "./types";

type EntranceButtonProps = {
  position: Point | null;
  scale?: number;
  text?: string;
  entering?: boolean;
  isFake?: boolean;
  isFading?: boolean;
  disabled?: boolean;
  tabIndex?: number;
  onClick: MouseEventHandler<HTMLButtonElement>;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
};

export const EntranceButton = forwardRef<
  HTMLButtonElement,
  EntranceButtonProps
>(function EntranceButton(
  {
    position,
    scale = 1,
    text = "입장하기",
    entering = false,
    isFake = false,
    isFading = false,
    disabled = false,
    tabIndex,
    onClick,
    onPointerDown,
  },
  ref,
) {
  const style = {
    "--button-scale": scale,
    ...(position ? { left: position.x, top: position.y } : {}),
  } as CSSProperties;

  const classes = [
    "entrance-button",
    position ? "is-placed" : "is-centered",
    isFake ? "entrance-button--fake" : "entrance-button--real",
    isFading ? "is-fading" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      style={style}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-describedby={isFake ? undefined : "entrance-status"}
      disabled={disabled || entering || isFading}
      tabIndex={tabIndex}
    >
      <span>{entering ? "입장 중…" : text}</span>
    </button>
  );
});
