import { GAME_CONFIG } from "./gameConfig";
import type { StageConfig } from "./types";

const GROUND_Y = 440;

export const STAGE_1: StageConfig = {
  length: 3_650,
  groundY: GROUND_Y,
  deathY: 650,
  start: {
    x: 80,
    y: GROUND_Y - GAME_CONFIG.player.height,
  },
  ground: [
    { type: "ground", x: 0, y: GROUND_Y, width: 720, height: 16 },
    { type: "ground", x: 810, y: GROUND_Y, width: 660, height: 16 },
    { type: "ground", x: 1_570, y: GROUND_Y, width: 810, height: 16 },
    { type: "ground", x: 2_490, y: GROUND_Y, width: 1_160, height: 16 },
  ],
  platforms: [
    { type: "platform", x: 1_080, y: 356, width: 160, height: 14 },
    { type: "platform", x: 1_880, y: 370, width: 140, height: 14 },
    { type: "platform", x: 2_100, y: 320, width: 160, height: 14 },
  ],
  obstacles: [
    {
      type: "moving-obstacle",
      x: 3_100,
      y: GROUND_Y - 32,
      width: 32,
      height: 32,
      minX: 3_040,
      maxX: 3_230,
      speed: 70,
    },
  ],
  goal: {
    type: "goal",
    x: 3_480,
    y: GROUND_Y - 100,
    width: 72,
    height: 100,
    label: "EXIT",
  },
};
