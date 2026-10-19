"use client";

import { EyeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

/** The bilingual-by-locale oversight disclosure shown at signup and in settings. */
export function OversightNotice() {
  const t = useTranslations("onboarding");
  return (
    <section className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
      <h2 className="mb-2 flex items-center gap-2 font-semibold text-primary">
        <EyeIcon className="size-4" />
        {t("noticeTitle")}
      </h2>
      <p className="mb-2 text-muted-foreground">{t("noticeIntro")}</p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>{t("noticePresidium")}</li>
        <li>{t("noticeLead")}</li>
        <li>{t("noticeAudit")}</li>
        <li>{t("noticePrivate")}</li>
      </ul>
    </section>
  );
}
