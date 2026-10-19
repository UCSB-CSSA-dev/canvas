"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { setStoredLocale, useStoredLocale, type Locale } from "@/lib/locale-store";

const LABELS: Record<Locale, string> = { zh: "中", en: "EN" };

export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const locale = useStoredLocale();
  const { isAuthenticated } = useConvexAuth();
  const saveLocale = useMutation(api.users.setLocale);

  const choose = (next: Locale) => {
    setStoredLocale(next);
    if (isAuthenticated) void saveLocale({ locale: next }).catch(() => undefined);
  };

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn("inline-flex rounded-md border border-border p-0.5", className)}
    >
      {(["zh", "en"] as const).map((option) => (
        <Button
          key={option}
          size="xs"
          variant="ghost"
          aria-pressed={locale === option}
          onClick={() => choose(option)}
          className={cn(
            "min-w-9",
            locale === option
              ? "bg-accent text-primary hover:text-primary"
              : "text-muted-foreground",
          )}
        >
          {LABELS[option]}
        </Button>
      ))}
    </div>
  );
}
