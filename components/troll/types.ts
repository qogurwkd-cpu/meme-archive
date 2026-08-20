export type TrollEffect =
  | "runaway"
  | "shrink"
  | "teleport"
  | "fake"
  | "text"
  | "input";

export type Point = { x: number; y: number };

export type TrollRoundStart = {
  id: number;
  effect: TrollEffect;
  buttonText: string;
};

export type TrollRoundCompletion = {
  completed: boolean;
  entranceReady: boolean;
};

export type FakeButtonState = {
  id: number;
  position: Point;
  isReal: boolean;
  isFading: boolean;
};
