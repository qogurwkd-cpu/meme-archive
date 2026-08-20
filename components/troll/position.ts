import type { Point } from "./types";

export const SAFE_MARGIN = 20;

function limits(width: number, height: number) {
  return {
    maxX: Math.max(SAFE_MARGIN, window.innerWidth - width - SAFE_MARGIN),
    maxY: Math.max(SAFE_MARGIN, window.innerHeight - height - SAFE_MARGIN),
  };
}

export function clampPosition(
  point: Point,
  width: number,
  height: number,
): Point {
  const { maxX, maxY } = limits(width, height);
  return {
    x: Math.min(Math.max(point.x, SAFE_MARGIN), maxX),
    y: Math.min(Math.max(point.y, SAFE_MARGIN), maxY),
  };
}

export function centeredPosition(width: number, height: number): Point {
  return clampPosition(
    {
      x: window.innerWidth / 2 - width / 2,
      y: window.innerHeight / 2 - height / 2,
    },
    width,
    height,
  );
}

export function randomPosition(width: number, height: number): Point {
  const { maxX, maxY } = limits(width, height);
  return {
    x: SAFE_MARGIN + Math.random() * Math.max(0, maxX - SAFE_MARGIN),
    y: SAFE_MARGIN + Math.random() * Math.max(0, maxY - SAFE_MARGIN),
  };
}

export function runawayStepPosition(pointer: Point, rect: DOMRect): Point {
  const center = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const delta = { x: center.x - pointer.x, y: center.y - pointer.y };
  const length = Math.hypot(delta.x, delta.y);
  const baseAngle =
    length > 0.5
      ? Math.atan2(delta.y, delta.x)
      : Math.random() * Math.PI * 2;
  const proximity = Math.max(0, Math.min(1, (110 - length) / 110));
  const travel = 32 + proximity * 36;
  const angles = [0, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];

  return angles.reduce<Point>(
    (best, offset) => {
      const candidate = clampPosition(
        {
          x: rect.left + Math.cos(baseAngle + offset) * travel,
          y: rect.top + Math.sin(baseAngle + offset) * travel,
        },
        rect.width,
        rect.height,
      );
      const candidateDistance = Math.hypot(
        candidate.x - rect.left,
        candidate.y - rect.top,
      );
      const bestDistance = Math.hypot(best.x - rect.left, best.y - rect.top);
      return candidateDistance > bestDistance ? candidate : best;
    },
    clampPosition(
      {
        x: rect.left + Math.cos(baseAngle) * travel,
        y: rect.top + Math.sin(baseAngle) * travel,
      },
      rect.width,
      rect.height,
    ),
  );
}

export function distantPosition(
  width: number,
  height: number,
  origin: Point,
): Point {
  const diagonal = Math.hypot(window.innerWidth, window.innerHeight);
  const compactViewport = Math.min(window.innerWidth, window.innerHeight) < 600;
  const requestedDistance = compactViewport ? 180 : 300;
  const minimumDistance = Math.min(requestedDistance, diagonal * 0.34);
  let best = randomPosition(width, height);
  let bestDistance = 0;

  for (let attempt = 0; attempt < 28; attempt += 1) {
    const candidate = randomPosition(width, height);
    const center = {
      x: candidate.x + width / 2,
      y: candidate.y + height / 2,
    };
    const distance = Math.hypot(center.x - origin.x, center.y - origin.y);
    if (distance >= minimumDistance) return candidate;
    if (distance > bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function rectanglesOverlap(
  point: Point,
  width: number,
  height: number,
  other: { left: number; top: number; right: number; bottom: number },
  padding = 24,
) {
  return !(
    point.x + width + padding < other.left ||
    point.x - padding > other.right ||
    point.y + height + padding < other.top ||
    point.y - padding > other.bottom
  );
}

export function scatteredButtonPositions(
  width: number,
  height: number,
  count = 4,
): Point[] {
  const positions: Point[] = [];
  const padding = Math.min(window.innerWidth, window.innerHeight) < 600 ? 12 : 28;

  for (let index = 0; index < count; index += 1) {
    let candidate = randomPosition(width, height);
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const next = randomPosition(width, height);
      const overlapsFake = positions.some((point) =>
        rectanglesOverlap(next, width, height, {
          left: point.x,
          top: point.y,
          right: point.x + width,
          bottom: point.y + height,
        }, padding),
      );
      const score = positions.length === 0
        ? Infinity
        : Math.min(
            ...positions.map((point) =>
              Math.hypot(next.x - point.x, next.y - point.y),
            ),
          );
      if (score > bestScore) {
        candidate = next;
        bestScore = score;
      }
      if (!overlapsFake) break;
    }
    positions.push(candidate);
  }

  return positions;
}
