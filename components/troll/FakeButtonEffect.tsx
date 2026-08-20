"use client";

import { EntranceButton } from "./EntranceButton";
import type { FakeButtonState } from "./types";

type FakeButtonEffectProps = {
  buttons: FakeButtonState[];
  onButtonClick: (id: number) => void;
};

export function FakeButtonEffect({
  buttons,
  onButtonClick,
}: FakeButtonEffectProps) {
  if (buttons.length === 0) return null;

  return (
    <div className="fake-buttons" aria-label="입장 버튼 선택지">
      {buttons.map((button) => (
        <EntranceButton
          key={button.id}
          position={button.position}
          text="입장하기"
          isFake
          isFading={button.isFading}
          onClick={() => onButtonClick(button.id)}
        />
      ))}
    </div>
  );
}
