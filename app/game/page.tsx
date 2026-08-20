import type { Metadata } from "next";
import { MiniGame } from "@/components/game/MiniGame";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mini Game",
  description: "Meme Archive로 들어가기 위한 짧은 흑백 플랫폼 게임입니다.",
};

export default function GamePage() {
  return <MiniGame />;
}
