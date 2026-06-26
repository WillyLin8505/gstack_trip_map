import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "旅遊行程規劃 | Trip Planner",
  description: "輸入景點清單，自動規劃每日行程與最佳路線",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
