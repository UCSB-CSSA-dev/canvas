"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { setStoredTheme, useStoredTheme } from "@/lib/theme-store";

export function ThemeToggle() {
  const t = useTranslations("nav");
  const theme = useStoredTheme();
  const label = t(theme === "dark" ? "switchToLight" : "switchToDark");
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      onClick={() => setStoredTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
