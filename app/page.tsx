import type { Metadata } from "next";
import { Entrance } from "@/components/entrance/Entrance";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "입구",
  description: "Meme Archive의 조금 짓궂은 입구입니다.",
};

export default function Home() {
  return <Entrance />;
}
