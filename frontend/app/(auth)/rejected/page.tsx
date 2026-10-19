"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { BanIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { AccountGate, useViewer } from "@/components/auth/account-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";

export default function RejectedPage() {
  return (
    <AccountGate allow={["rejected"]}>
      <RejectedCard />
    </AccountGate>
  );
}

function RejectedCard() {
  const t = useTranslations();
  const viewer = useViewer();
  const { signOut } = useAuthActions();
  const reapply = useMutation(api.users.reapply);
  const showError = useErrorToast();
  const deactivated = viewer.status === "deactivated";

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <BanIcon className="mx-auto mb-2 size-8 text-destructive" />
        <CardTitle>{deactivated ? t("rejected.titleDeactivated") : t("rejected.titleRejected")}</CardTitle>
        {deactivated ? <CardDescription>{t("rejected.bodyDeactivated")}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {!deactivated && viewer.rejectionReason ? (
          <p className="w-full rounded-md bg-secondary p-3 text-left text-sm whitespace-pre-wrap">
            <span className="text-muted-foreground">{t("rejected.reason")} </span>
            {viewer.rejectionReason}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => void signOut()}>
            {t("common.signOut")}
          </Button>
          {!deactivated ? (
            <Button onClick={() => void reapply().catch(showError)}>{t("rejected.reapply")}</Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
