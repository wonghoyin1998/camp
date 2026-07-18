import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "棋航者：最後登船令",
  description: "Board Game 導師訓練計劃營會的即時資源、交易、佔領及港鐵任務平台。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-HK">
      <body>{children}</body>
    </html>
  );
}
