"use client";

import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/layout/brand";
import { cn } from "@/lib/utils";

/** `branded` fills the screen and adds the logo; leave it off inside layouts that already show one. */
export function FullPageLoading({ branded = false }: { branded?: boolean }) {
  const t = useTranslations("common");
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", branded && "min-h-dvh")}>
      {branded ? <BrandMark className="h-12 animate-pulse" /> : null}
      <span className="text-sm text-muted-foreground">{t("loading")}</span>
    </div>
  );
}
