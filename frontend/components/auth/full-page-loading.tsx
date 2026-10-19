"use client";

import { useTranslations } from "next-intl";

export function FullPageLoading() {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="text-sm text-muted-foreground">{t("loading")}</span>
    </div>
  );
}
