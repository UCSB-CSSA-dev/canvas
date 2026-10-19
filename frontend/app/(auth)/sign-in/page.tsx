"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { AccountGate } from "@/components/auth/account-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignInPage() {
  return (
    <AccountGate allow={["signedOut"]}>
      <Suspense>
        <SignInCard />
      </Suspense>
    </AccountGate>
  );
}

function SignInCard() {
  const t = useTranslations("signIn");
  const { signIn } = useAuthActions();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  // OAuth callback errors redirect back here without a session.
  const failed = params.get("from") === "google";

  const start = async () => {
    setBusy(true);
    try {
      await signIn("google", { redirectTo: "/sign-in/?from=google" });
    } catch {
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mb-2 text-2xl font-semibold">
          <span className="text-primary">CSSA</span> Hub
        </div>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {failed ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {t("failed")}
          </p>
        ) : null}
        <Button size="lg" onClick={() => void start()} disabled={busy}>
          <GoogleIcon />
          {t("google")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t("domainHint")}</p>
        <Link href="/privacy/" className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
          {t("privacyLink")}
        </Link>
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.43-1.66 4.2-5.35 4.2-3.22 0-5.85-2.67-5.85-5.96s2.63-5.96 5.85-5.96c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.82 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z"
      />
    </svg>
  );
}
