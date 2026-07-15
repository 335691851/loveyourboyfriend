import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "今晚见｜沉浸式陪伴",
  description: "一个会记得你的虚拟陪伴角色。",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#110b15",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
