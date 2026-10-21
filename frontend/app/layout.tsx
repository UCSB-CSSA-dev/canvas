import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "CSSA Hub",
  description: "UCSB CSSA internal platform",
  appleWebApp: { capable: true, title: "CSSA Hub", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  // Without this iOS reports zero safe-area insets, and the home indicator covers the bottom bar.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="dark h-full antialiased">
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
