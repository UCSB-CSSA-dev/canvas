import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "CSSA Hub",
  description: "UCSB CSSA internal platform",
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
