import type { Metadata } from "next";
import "./globals.css";

const metadataBase = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://meme-archive.example",
);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const socialImage = new URL(`${basePath}/og.png`, metadataBase).toString();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Meme Archive — 인터넷 웃음 보관소",
    template: "%s | Meme Archive",
  },
  description:
    "유행은 지나가도 밈은 남습니다. 인터넷의 웃긴 순간을 맥락과 함께 모아보는 작은 아카이브.",
  openGraph: {
    title: "Meme Archive — 인터넷 웃음 보관소",
    description: "유행은 지나가도 밈은 남습니다.",
    type: "website",
    images: [{ url: socialImage, width: 1792, height: 896 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meme Archive — 인터넷 웃음 보관소",
    description: "유행은 지나가도 밈은 남습니다.",
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
