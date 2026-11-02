import type { ReactNode } from "react";
import { BrandLogo } from "@/components/layout/brand";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="absolute top-4 right-4 flex items-center gap-2"><ThemeToggle /><LanguageToggle /></div>
      <BrandLogo className="w-full max-w-80" />
      {children}
    </div>
  );
}
