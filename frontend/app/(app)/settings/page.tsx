"use client";

import { useTranslations } from "next-intl";
import { useViewer } from "@/components/auth/account-state";
import { OversightNotice } from "@/components/auth/oversight-notice";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { PageHeader } from "@/components/layout/app-shell";
import { PushNotificationsCard } from "@/components/settings/push-notifications-card";
import { DeactivateCard } from "@/components/settings/deactivate-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { WhoCanSeeCard } from "@/components/settings/who-can-see-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSignOut } from "@/lib/push";

export default function SettingsPage() {
  const t = useTranslations();
  const viewer = useViewer();
  const signOut = useSignOut();

  return (
    <>
      <PageHeader title={t("settings.title")} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
          <ProfileCard />

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.language")}</CardTitle>
            </CardHeader>
            <CardContent>
              <LanguageToggle />
            </CardContent>
          </Card>

          <PushNotificationsCard />

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.account")}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {t("settings.signedInAs", { email: viewer.email ?? "" })}
              </span>
              <Button variant="outline" onClick={() => void signOut()}>
                {t("common.signOut")}
              </Button>
            </CardContent>
          </Card>

          <WhoCanSeeCard />
          <OversightNotice />
          <DeactivateCard />
        </div>
      </div>
    </>
  );
}
