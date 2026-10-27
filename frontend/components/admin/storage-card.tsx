"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { PencilIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, LIMITS } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { localized } from "@/lib/names";
import { cn } from "@/lib/utils";

type Overview = FunctionReturnType<typeof api.admin.overview>;
type Storage = NonNullable<Overview["storage"]>;
type Space = Storage["spaces"][number];

const MB = 1024 * 1024;

export function UsageBar({ used, total, className }: { used: number; total: number; className?: string }) {
  const ratio = total > 0 ? Math.min(1, used / total) : 1;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className={cn("h-full rounded-full", ratio >= 0.9 ? "bg-destructive" : ratio >= 0.75 ? "bg-warning" : "bg-primary")}
        style={{ width: `${Math.max(ratio * 100, used > 0 ? 2 : 0)}%` }}
      />
    </div>
  );
}

export function StorageCard({ storage }: { storage: Storage }) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [editing, setEditing] = useState<Space | null>(null);
  const spaceName = (s: Space) => (s.nameZh ? localized(s.nameZh, s.nameEn ?? s.nameZh, locale) : t("publicSpace"));
  const quotaTotal = storage.spaces.reduce((sum, s) => sum + s.quotaBytes, 0);
  const warn = storage.bytes >= storage.warnBytes || quotaTotal > storage.warnBytes;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("storageTitle")}</CardTitle>
        <CardDescription>{t("storageBody", { cap: formatBytes(storage.capBytes) })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className={cn("font-medium", warn && "text-destructive")}>
              {t("storageUsed", { used: formatBytes(storage.bytes), cap: formatBytes(storage.capBytes) })}
            </span>
            <span className="text-xs text-muted-foreground">{t("files", { count: storage.files })}</span>
          </div>
          <UsageBar used={storage.bytes} total={storage.capBytes} />
          {warn ? <p className="text-xs text-destructive">{t("storageWarning")}</p> : null}
        </div>
        <div className="flex flex-col divide-y divide-border">
          {storage.spaces.map((s) => (
            <div key={s.key} className="flex items-center gap-3 py-2 text-sm">
              <span className={cn("w-28 shrink-0 truncate", s.archived && "text-muted-foreground")}>{spaceName(s)}</span>
              <UsageBar used={s.usedBytes} total={s.quotaBytes} className="min-w-12 flex-1" />
              <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
                {formatBytes(s.usedBytes)} / {formatBytes(s.quotaBytes)}
              </span>
              <Button size="icon-sm" variant="ghost" aria-label={t("editQuota")} onClick={() => setEditing(s)}>
                <PencilIcon />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-3 py-2 text-sm">
            <span className="w-28 shrink-0 truncate">{t("chatAttachments")}</span>
            <span className="flex-1 text-xs text-muted-foreground">{t("chatAttachmentsHint", { days: LIMITS.attachmentRetentionDays })}</span>
            <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">{formatBytes(storage.attachmentBytes)}</span>
            <span className="size-8" />
          </div>
          <div className="flex items-center gap-3 py-2 text-sm">
            <span className="w-28 shrink-0 truncate">Google Drive</span>
            <span className="flex-1 text-xs text-muted-foreground">
              {t("driveHint", { count: storage.driveFiles, max: formatBytes(LIMITS.fileBytes) })}
            </span>
            <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">{formatBytes(storage.driveBytes)}</span>
            <span className="size-8" />
          </div>
        </div>
      </CardContent>
      <QuotaDialog space={editing} name={editing ? spaceName(editing) : ""} onClose={() => setEditing(null)} />
    </Card>
  );
}

function QuotaDialog({ space, name, onClose }: { space: Space | null; name: string; onClose: () => void }) {
  const t = useTranslations("admin");
  const setQuota = useMutation(api.files.setQuota);
  const showError = useErrorToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (space && openedFor !== space.key) {
    setOpenedFor(space.key);
    setValue(String(Math.round(space.quotaBytes / MB)));
  }
  const mb = Number(value);
  const valid = Number.isFinite(mb) && mb >= 0 && mb * MB <= LIMITS.maxSpaceQuotaBytes;

  const close = () => {
    setOpenedFor(null);
    onClose();
  };

  return (
    <Dialog open={space !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("quotaTitle", { name })}</DialogTitle>
          <DialogDescription>
            {t("quotaBody", { used: formatBytes(space?.usedBytes ?? 0), max: formatBytes(LIMITS.maxSpaceQuotaBytes) })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} step={5} value={value} onChange={(e) => setValue(e.target.value)} className="w-32" />
          <span className="text-sm text-muted-foreground">MB</span>
        </div>
        {space && valid && mb * MB < space.usedBytes ? <p className="text-xs text-warning">{t("quotaBelowUsage")}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!valid || busy}
            onClick={async () => {
              if (!space) return;
              setBusy(true);
              try {
                await setQuota({ space: space.key, quotaBytes: Math.round(mb * MB) });
                toast.success(t("quotaSaved"));
                close();
              } catch (error) {
                showError(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmailCard({ email }: { email: NonNullable<Overview["email"]> }) {
  const t = useTranslations("admin");
  const status = email.dryRun ? t("emailDryRun") : email.configured ? t("emailConfigured") : t("emailNotConfigured");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("emailTitle")}</CardTitle>
        <CardDescription>{t("emailBody")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className={cn("text-sm", !email.configured && !email.dryRun && "text-warning")}>{status}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <EmailStat label={t("emailSent")} value={email.sent} />
          <EmailStat label={t("emailPending")} value={email.pending} />
          <EmailStat label={t("emailFailed")} value={email.failed} danger />
          <EmailStat label={t("emailSkipped")} value={email.skipped} />
        </div>
        <p className="text-xs text-muted-foreground">{t("emailToday", { day: email.day })}</p>
        {email.lastError ? (
          <p className="text-xs text-destructive">
            {email.lastError === "QUOTA" ? t("emailQuota") : t("emailLastError", { error: email.lastError })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmailStat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex flex-col rounded-md border border-border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-semibold", danger && value > 0 && "text-destructive")}>{value}</span>
    </div>
  );
}
