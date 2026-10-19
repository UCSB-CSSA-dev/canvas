import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/layout/language-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <LanguageToggle className="absolute top-4 right-4" />
      {children}
    </div>
  );
}
