import type { Platform, Rect } from "../types";

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function moveToward(current: number, target: number, amount: number) {
  if (current < target) return Math.min(current + amount, target);
  if (current > target) return Math.max(current - amount, target);
  return target;
}

export function rectanglesOverlap(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function findLandingSurface(
  previousBottom: number,
  nextBottom: number,
  playerX: number,
  playerWidth: number,
  surfaces: Platform[],
) {
  return surfaces
    .filter(
      (surface) =>
        previousBottom <= surface.y + 2 &&
        nextBottom >= surface.y &&
        playerX + playerWidth > surface.x + 2 &&
        playerX < surface.x + surface.width - 2,
    )
    .sort((a, b) => a.y - b.y)[0] ?? null;
}
