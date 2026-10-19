"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { AccountGate, useViewer } from "@/components/auth/account-state";
import { OversightNotice } from "@/components/auth/oversight-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, LIMITS, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { localized } from "@/lib/names";

export default function OnboardingPage() {
  return (
    <AccountGate allow={["onboarding"]}>
      <OnboardingForm />
    </AccountGate>
  );
}

function OnboardingForm() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const viewer = useViewer();
  const { signOut } = useAuthActions();
  const departments = useQuery(api.departments.listPublic);
  const submit = useMutation(api.users.submitOnboarding);
  const showError = useErrorToast();

  const [nameZh, setNameZh] = useState(viewer.nameZh ?? "");
  const [nameEn, setNameEn] = useState(viewer.nameEn ?? viewer.name ?? "");
  const [requested, setRequested] = useState<Id<"departments">[]>(viewer.requestedDepartmentIds);
  const [note, setNote] = useState(viewer.applicationNote ?? "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const skipsReview = viewer.status === "approved" || viewer.preApprovals.length > 0;
  const regular = (departments ?? []).filter((d) => d.kind === "regular");
  const canSubmit =
    consent &&
    nameZh.trim() !== "" &&
    nameEn.trim() !== "" &&
    (skipsReview || requested.length > 0) &&
    !busy;

  const toggle = (id: Id<"departments">, checked: boolean) =>
    setRequested((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await submit({
        nameZh,
        nameEn,
        consent,
        requestedDepartmentIds: skipsReview ? undefined : requested,
        applicationNote: skipsReview ? undefined : note,
      });
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{t("onboarding.title")}</CardTitle>
        <CardDescription>{t("onboarding.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nameZh">{t("onboarding.nameZh")}</Label>
              <Input
                id="nameZh"
                value={nameZh}
                maxLength={LIMITS.nameLength}
                onChange={(e) => setNameZh(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nameEn">{t("onboarding.nameEn")}</Label>
              <Input
                id="nameEn"
                value={nameEn}
                maxLength={LIMITS.nameLength}
                onChange={(e) => setNameEn(e.target.value)}
                required
              />
            </div>
          </div>

          {viewer.preApprovals.length > 0 ? (
            <div className="flex flex-col gap-2 text-sm">
              <span>{t("onboarding.preApproved")}</span>
              <div className="flex flex-wrap gap-2">
                {viewer.preApprovals.map((p) => (
                  <Badge key={p.departmentId} variant="secondary">
                    {localized(p.nameZh, p.nameEn, locale)} · {t(`roles.${p.role}`)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {!skipsReview ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">{t("onboarding.departments")}</legend>
                <p className="text-xs text-muted-foreground">{t("onboarding.departmentsHint")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {regular.map((d) => (
                    <label
                      key={d._id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={requested.includes(d._id)}
                        onCheckedChange={(checked) => toggle(d._id, checked === true)}
                      />
                      {localized(d.nameZh, d.nameEn, locale)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-col gap-2">
                <Label htmlFor="note">
                  {t("onboarding.note")} <span className="text-muted-foreground">{t("common.optional")}</span>
                </Label>
                <Textarea
                  id="note"
                  value={note}
                  maxLength={LIMITS.applicationNote}
                  placeholder={t("onboarding.notePlaceholder")}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </>
          ) : null}

          <OversightNotice />

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
            />
            {t("onboarding.consent")}
          </label>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => void signOut()}>
              {t("common.signOut")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {skipsReview ? t("onboarding.submitApproved") : t("onboarding.submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
