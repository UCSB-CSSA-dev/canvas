"use client";

import { useTranslations } from "next-intl";

export function MissingConfig() {
  const t = useTranslations("errors");
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <p className="max-w-md text-center text-sm text-muted-foreground">{t("missingConvexUrl")}</p>
    </main>
  );
}
