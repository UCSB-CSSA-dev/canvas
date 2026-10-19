"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { HourglassIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AccountGate, useViewer } from "@/components/auth/account-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Locale } from "@/lib/locale-store";
import { localized } from "@/lib/names";

export default function PendingPage() {
  return (
    <AccountGate allow={["pending"]}>
      <PendingCard />
    </AccountGate>
  );
}

function PendingCard() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const viewer = useViewer();
  const { signOut } = useAuthActions();
  const departments = useQuery(api.departments.listPublic) ?? [];
  const requested = departments.filter((d) => viewer.requestedDepartmentIds.includes(d._id));

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <HourglassIcon className="mx-auto mb-2 size-8 text-primary" />
        <CardTitle>{t("pending.title")}</CardTitle>
        <CardDescription>{t("pending.body")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {requested.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("pending.requested")}</span>
            {requested.map((d) => (
              <Badge key={d._id} variant="secondary">
                {localized(d.nameZh, d.nameEn, locale)}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">{viewer.email}</p>
        <Button variant="ghost" onClick={() => void signOut()}>
          {t("common.signOut")}
        </Button>
      </CardContent>
    </Card>
  );
}
