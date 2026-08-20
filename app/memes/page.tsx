import type { Metadata } from "next";
import { MemeArchive } from "@/components/meme/MemeArchive";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "아카이브",
  description: "인터넷의 웃긴 순간을 맥락과 함께 탐색하세요.",
};

export default function MemesPage() {
  return <MemeArchive />;
}
