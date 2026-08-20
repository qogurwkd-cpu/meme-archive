import type { TrollEffect } from "./types";

export const TROLL_EFFECTS: TrollEffect[] = [
  "runaway",
  "shrink",
  "teleport",
  "fake",
  "text",
  "input",
];

export const TROLL_TEXTS = [
  "입장하기",
  "이번엔 진짜",
  "못 누르겠지?",
  "거의 다 왔어요",
  "진짜 입장하기",
  "미안합니다",
];

export const EFFECT_MESSAGES: Record<TrollEffect, string> = {
  runaway: "어라, 조금 비켜났어요.",
  shrink: "작다고 못 누를 건 없죠?",
  teleport: "버튼은 멀리서도 좋아합니다.",
  fake: "진짜는 하나뿐입니다.",
  text: "글자는 믿지 마세요.",
  input: "안내문을 잘 읽어보세요.",
};

export const MIN_TROLL_ROUNDS = 5;
export const MAX_TROLL_ROUNDS = 7;

export function createTargetRoundCount() {
  return (
    MIN_TROLL_ROUNDS +
    Math.floor(Math.random() * (MAX_TROLL_ROUNDS - MIN_TROLL_ROUNDS + 1))
  );
}
