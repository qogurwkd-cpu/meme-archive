"use client";

type MobileControlsProps = {
  onMove: (direction: "left" | "right", pressed: boolean) => void;
  onJump: (pressed: boolean) => void;
};

export function MobileControls({ onMove, onJump }: MobileControlsProps) {
  const controlProps = (onPressed: (pressed: boolean) => void) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onPressed(true);
    },
    onPointerUp: () => {
      onPressed(false);
    },
    onPointerCancel: () => {
      onPressed(false);
    },
    onLostPointerCapture: () => {
      onPressed(false);
    },
  });

  return (
    <div className="mobile-controls" aria-label="모바일 게임 조작">
      <div className="mobile-controls__move">
        <button
          type="button"
          aria-label="왼쪽으로 이동"
          {...controlProps((pressed) => onMove("left", pressed))}
        >
          ←
        </button>
        <button
          type="button"
          aria-label="오른쪽으로 이동"
          {...controlProps((pressed) => onMove("right", pressed))}
        >
          →
        </button>
      </div>
      <button
        type="button"
        className="mobile-controls__jump"
        aria-label="점프"
        {...controlProps(onJump)}
      >
        ↑
      </button>
    </div>
  );
}
