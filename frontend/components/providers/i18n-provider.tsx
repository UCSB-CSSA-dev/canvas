"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { useStoredLocale } from "@/lib/locale-store";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

const MESSAGES = { zh, en };

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useStoredLocale();

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale]}
      timeZone="America/Los_Angeles"
    >
      {children}
    </NextIntlClientProvider>
  );
}
