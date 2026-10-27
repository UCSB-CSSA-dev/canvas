"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useViewer } from "@/components/auth/account-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, LIMITS } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";

export function DigestEmailCard() {
  const t = useTranslations("settings");
  const viewer = useViewer();
  const setDigestEmail = useMutation(api.users.setDigestEmail);
  const showError = useErrorToast();
  const [email, setEmail] = useState(viewer.digestEmail ?? "");
  const [busy, setBusy] = useState(false);
  const current = viewer.digestEmail ?? "";
  const dirty = email.trim().toLowerCase() !== current;

  const save = async (value: string | null) => {
    setBusy(true);
    try {
      await setDigestEmail({ email: value });
      if (value === null) setEmail("");
      toast.success(t("digestSaved"));
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save(email.trim() || null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("digestTitle")}</CardTitle>
        <CardDescription>{t("digestBody")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <Label htmlFor="digest-email">{t("digestAddress")}</Label>
          <div className="flex gap-2">
            <Input
              id="digest-email"
              type="email"
              value={email}
              maxLength={LIMITS.digestEmail}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={viewer.email ?? ""}
            />
            <Button type="submit" disabled={busy || !dirty}>
              {t("save")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {current ? t("digestUsingCustom", { email: current }) : t("digestUsingDefault", { email: viewer.email ?? "" })}
            {current ? (
              <>
                {" "}
                <button type="button" className="text-primary hover:underline" disabled={busy} onClick={() => void save(null)}>
                  {t("digestReset")}
                </button>
              </>
            ) : null}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
