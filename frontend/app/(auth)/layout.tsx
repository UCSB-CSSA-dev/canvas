import type { ReactNode } from "react";
import { BrandLogo } from "@/components/layout/brand";
import { LanguageToggle } from "@/components/layout/language-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <LanguageToggle className="absolute top-4 right-4" />
      <BrandLogo className="w-full max-w-80" />
      {children}
    </div>
  );
}
