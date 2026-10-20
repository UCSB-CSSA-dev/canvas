"use client";

import { useQuery } from "convex/react";
import { EyeIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PersonAvatar } from "@/components/people/person-avatar";
import type { UserSummaryLike } from "@/components/people/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Locale } from "@/lib/locale-store";
import { displayName, localized } from "@/lib/names";

/** Names the people who can read the viewer's chats through oversight. */
export function WhoCanSeeCard() {
  const t = useTranslations("settings");
  const locale = useLocale() as Locale;
  const data = useQuery(api.users.whoCanSeeMe);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <EyeIcon className="size-4 text-primary" />
          {t("whoCanSee")}
        </CardTitle>
        <CardDescription>{t("whoCanSeeHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!data ? (
          <Skeleton className="h-20" />
        ) : (
          <>
            <Group label={t("whoPresidium")} people={data.presidium} locale={locale} />
            <Group label={t("whoSystemAdmins")} people={data.systemAdmins} locale={locale} />
            {data.departments.map((d) => (
              <Group
                key={d.departmentId}
                label={t("whoLeads", { department: localized(d.nameZh, d.nameEn, locale) })}
                people={d.leads}
                locale={locale}
                empty={t("whoNoLead")}
              />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Group({
  label,
  people,
  locale,
  empty,
}: {
  label: string;
  people: UserSummaryLike[];
  locale: Locale;
  empty?: string;
}) {
  if (people.length === 0 && !empty) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {people.length === 0 ? (
        <span className="text-sm text-subtle-foreground">{empty}</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <span key={p._id} className="flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pr-2.5 pl-0.5 text-sm">
              <PersonAvatar person={p} className="size-5" />
              {displayName(p, locale)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
