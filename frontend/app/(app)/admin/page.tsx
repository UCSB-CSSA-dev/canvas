"use client";

import { useMutation, useQuery } from "convex/react";
import { ArchiveIcon, ArchiveRestoreIcon, ScrollTextIcon } from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useViewer } from "@/components/auth/account-state";
import { formatBytes } from "@/components/chat/attachments";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, archivePhrase, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { localized } from "@/lib/names";

type ArchiveTarget = { _id: Id<"departments">; nameZh: string; nameEn: string };

export default function AdminPage() {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const viewer = useViewer();
  const isManager = viewer.isAdmin || viewer.ledDepartmentIds.length > 0;
  const overview = useQuery(api.admin.overview, isManager ? {} : "skip");
  const [archiving, setArchiving] = useState<ArchiveTarget | null>(null);

  if (!isManager) {
    return (
      <>
        <PageHeader title={t("title")} />
        <p className="m-auto text-sm text-muted-foreground">{t("forbidden")}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("title")}>
        {viewer.isAdmin ? (
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/audit/">
              <ScrollTextIcon />
              {t("auditLog")}
            </Link>
          </Button>
        ) : null}
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4">
          <p className="text-sm text-muted-foreground">{overview?.scope === "org" ? t("scopeOrg") : t("scopeDepartments")}</p>
          {!overview ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label={t("activeMembers")} value={overview.activeMembers} />
                <Stat label={t("pendingApprovals")} value={overview.pendingApprovals} href="/roster/" highlight />
                <Stat label={t("preApprovals")} value={overview.preApprovals} href="/roster/" />
                <Stat label={t("pendingGroups")} value={overview.pendingGroups} href="/chat/?proposals=1" highlight />
                {overview.pendingDeactivations !== null ? (
                  <Stat label={t("pendingDeactivations")} value={overview.pendingDeactivations} href="/roster/" highlight />
                ) : null}
                {overview.unassigned !== null ? <Stat label={t("unassigned")} value={overview.unassigned} href="/roster/" /> : null}
                {overview.storage ? (
                  <Stat
                    label={t("storage")}
                    value={formatBytes(overview.storage.bytes)}
                    hint={t("files", { count: overview.storage.files })}
                  />
                ) : null}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{t("departments")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col divide-y divide-border">
                  {overview.perDepartment.map((d) => (
                    <div key={d.departmentId} className="flex items-center gap-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium">{localized(d.nameZh, d.nameEn, locale)}</span>
                      {d.leads === 0 && d.kind !== "presidium" ? <Badge variant="destructive">{t("noLead")}</Badge> : null}
                      <span className="w-20 text-right text-muted-foreground">{t("leadsCount", { count: d.leads })}</span>
                      <span className="w-20 text-right text-muted-foreground">{t("membersCount", { count: d.members })}</span>
                      {viewer.isAdmin && d.kind !== "presidium" ? (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("archive")}
                          onClick={() => setArchiving({ _id: d.departmentId, nameZh: d.nameZh, nameEn: d.nameEn })}
                        >
                          <ArchiveIcon />
                        </Button>
                      ) : viewer.isAdmin ? (
                        <span className="size-8" />
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
              {viewer.isAdmin ? <ArchivedDepartments /> : null}
            </>
          )}
        </div>
      </div>
      <ArchiveDialog department={archiving} onClose={() => setArchiving(null)} />
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
  highlight,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <Card className="h-full py-4 transition-colors hover:bg-accent/40">
      <CardContent className="flex flex-col gap-1 px-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={highlight && value !== 0 ? "text-2xl font-semibold text-primary" : "text-2xl font-semibold"}>
          {value}
        </span>
        {hint ? <span className="text-xs text-subtle-foreground">{hint}</span> : null}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function ArchivedDepartments() {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const archived = useQuery(api.departments.listArchived);
  const unarchive = useMutation(api.departments.unarchive);
  const showError = useErrorToast();
  if (!archived || archived.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("archived")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {archived.map((d) => (
          <div key={d._id} className="flex items-center gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{localized(d.nameZh, d.nameEn, locale)}</span>
            <span className="text-xs text-muted-foreground">
              {t("archivedAt", { date: format.dateTime(d.archivedAt, { dateStyle: "medium" }) })} ·{" "}
              {t("membersCount", { count: d.memberCount })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                unarchive({ departmentId: d._id })
                  .then(() => toast.success(t("unarchived")))
                  .catch(showError)
              }
            >
              <ArchiveRestoreIcon />
              {t("unarchive")}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ArchiveDialog({ department, onClose }: { department: ArchiveTarget | null; onClose: () => void }) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const archive = useMutation(api.departments.archive);
  const showError = useErrorToast();
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const expected = department ? archivePhrase(department.nameZh) : "";

  return (
    <Dialog
      open={department !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPhrase("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("archiveTitle", { name: department ? localized(department.nameZh, department.nameEn, locale) : "" })}
          </DialogTitle>
          <DialogDescription>{t("archiveBody")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {t("typeToConfirm")} <code className="rounded bg-secondary px-1.5 py-0.5 text-primary">{expected}</code>
        </p>
        <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={expected} />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setPhrase("");
              onClose();
            }}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy || phrase.trim() !== expected}
            onClick={async () => {
              if (!department) return;
              setBusy(true);
              try {
                await archive({ departmentId: department._id, phrase });
                toast.success(t("archivedToast"));
                setPhrase("");
                onClose();
              } catch (error) {
                showError(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("archive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
