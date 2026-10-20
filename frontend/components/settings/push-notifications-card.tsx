"use client";

import { BellIcon, BellOffIcon, ShareIcon, SmartphoneIcon, SquarePlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useErrorToast } from "@/lib/errors";
import { usePush } from "@/lib/push";

export function PushNotificationsCard() {
  const t = useTranslations("settings");
  const push = usePush();
  const showError = useErrorToast();
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const enable = async () => {
    setBusy(true);
    try {
      if ((await push.enable()) === "on") {
        await push.test();
        toast.success(t("pushEnabled"));
      }
    } catch {
      toast.error(t("pushEnableFailed"));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    try {
      await push.test();
      toast.success(t("pushTestSent"));
    } catch (error) {
      showError(error);
    }
  };

  const guideButton = (primary: boolean) => (
    <Button variant={primary ? "default" : "ghost"} onClick={() => setGuideOpen(true)}>
      <SmartphoneIcon />
      {t("iosGuide")}
    </Button>
  );

  let body;
  if (push.configured === false) {
    body = <p className="w-full text-sm text-muted-foreground">{t("pushUnavailable")}</p>;
  } else if (push.state === "ios-install") {
    body = (
      <>
        <p className="w-full text-sm text-muted-foreground">{t("pushIosInstall")}</p>
        {guideButton(true)}
      </>
    );
  } else if (push.state === "unsupported" || push.state === "denied") {
    body = (
      <>
        <p className="w-full text-sm text-muted-foreground">
          {t(push.state === "denied" ? "pushDenied" : "pushUnsupported")}
        </p>
        {guideButton(false)}
      </>
    );
  } else if (push.state === "on") {
    body = (
      <>
        <Button variant="secondary" onClick={() => void test()}>
          <BellIcon />
          {t("pushTest")}
        </Button>
        <Button variant="ghost" onClick={() => void push.disable()}>
          <BellOffIcon />
          {t("pushDisable")}
        </Button>
        {guideButton(false)}
      </>
    );
  } else {
    body = (
      <>
        <Button onClick={() => void enable()} disabled={busy || push.configured === undefined}>
          <BellIcon />
          {t("pushEnable")}
        </Button>
        {guideButton(false)}
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t("push")}
          {push.state === "on" ? <Badge variant="secondary">{t("pushOn")}</Badge> : null}
        </CardTitle>
        <CardDescription>{t("pushHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">{body}</CardContent>
      <IosGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </Card>
  );
}

function IosGuideDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("settings");
  const icon = "mx-0.5 inline size-4 align-text-bottom text-primary";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("iosGuideTitle")}</DialogTitle>
          <DialogDescription>{t("iosGuideIntro")}</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed">
          <li>{t("iosStep1")}</li>
          <li>
            {t.rich("iosStep2", {
              share: () => <ShareIcon className={icon} aria-hidden />,
              add: () => <SquarePlusIcon className={icon} aria-hidden />,
            })}
          </li>
          <li>{t("iosStep3")}</li>
          <li>{t("iosStep4")}</li>
          <li>{t("iosStep5")}</li>
        </ol>
        <p className="text-xs text-muted-foreground">{t("iosGuideNote")}</p>
      </DialogContent>
    </Dialog>
  );
}
