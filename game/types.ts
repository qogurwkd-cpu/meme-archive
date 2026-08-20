export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Platform = Rect & {
  type: "ground" | "platform";
};

export type MovingObstacleConfig = Rect & {
  type: "moving-obstacle";
  minX: number;
  maxX: number;
  speed: number;
};

export type GoalConfig = Rect & {
  type: "goal";
  label: string;
};

export type CollapseFloorCandidate = Pick<Rect, "x" | "width">;

export type OverjumpConfig = {
  triggerZone: Pick<Rect, "x" | "width">;
};

export type StageConfig = {
  length: number;
  groundY: number;
  deathY: number;
  start: { x: number; y: number };
  ground: Platform[];
  platforms: Platform[];
  obstacles: MovingObstacleConfig[];
  collapseFloorCandidates: CollapseFloorCandidate[];
  overjump: OverjumpConfig;
  goal: GoalConfig;
};

export type PlayerBody = Rect & {
  velocityX: number;
  velocityY: number;
  onGround: boolean;
  coyoteTime: number;
};

export type GameInput = {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpBuffer: number;
};
