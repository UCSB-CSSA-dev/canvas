"use client";

import { useMutation, useQuery } from "convex/react";
import { FileTextIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
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
import { api, LIMITS, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";

/** The task's collaborative documents, with "New document" for people who can edit them. */
export function TaskDocuments({ assignmentId }: { assignmentId: Id<"assignments"> }) {
  const t = useTranslations("docs");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const data = useQuery(api.documents.listForTask, { assignmentId });
  const [creating, setCreating] = useState(false);
  if (!data || (data.documents.length === 0 && !data.canCreate)) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">{t("title")}</CardTitle>
        {data.canCreate ? (
          <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
            <PlusIcon />
            {t("new")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {data.documents.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
        {data.documents.map((doc) => (
          <Link
            key={doc._id}
            href={`/assignments/doc/?d=${doc._id}`}
            className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm hover:bg-secondary"
          >
            <FileTextIcon className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">{doc.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("edited", {
                name: doc.updatedBy ? displayName(doc.updatedBy, locale) : "?",
                time: format.relativeTime(doc.updatedAt),
              })}
            </span>
          </Link>
        ))}
      </CardContent>
      <NewDocumentDialog assignmentId={assignmentId} open={creating} onClose={() => setCreating(false)} />
    </Card>
  );
}

function NewDocumentDialog({
  assignmentId,
  open,
  onClose,
}: {
  assignmentId: Id<"assignments">;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("docs");
  const router = useRouter();
  const showError = useErrorToast();
  const create = useMutation(api.documents.create);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const id = await create({ assignmentId, title });
      router.push(`/assignments/doc/?d=${id}`);
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
          <DialogDescription>{t("newBody")}</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={title}
          maxLength={LIMITS.documentTitle}
          placeholder={t("titlePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={!title.trim() || busy} onClick={() => void submit()}>
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
