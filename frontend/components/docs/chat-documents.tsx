"use client";

import { useMutation, useQuery } from "convex/react";
import { ChevronRightIcon, FilePenLineIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import type { Message } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Id } from "@/lib/api";
import { docHref } from "@/lib/links";
import { DocumentRows, NewDocumentDialog } from "./task-documents";

/** Chats where any participant can start a shared document: everything except 全体. */
export function chatHasDocs(type: string) {
  return type === "department" || type === "group" || type === "dm";
}

/** The card a chat document posts in the chat. */
export function DocCardView({ doc }: { doc: Message["doc"] }) {
  const t = useTranslations("docs");
  const format = useFormatter();
  if (!doc) return <p className="text-sm text-muted-foreground italic">{t("cardGone")}</p>;
  return (
    <Link
      href={docHref(doc._id)}
      className="mt-1 flex max-w-md items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
    >
      <FilePenLineIcon className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-primary">{t("chatCardLabel")}</div>
        <div className="truncate text-sm font-semibold">{doc.title}</div>
        <div className="text-xs text-muted-foreground">{t("editedAt", { time: format.relativeTime(doc.updatedAt) })}</div>
      </div>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/** Starts a shared document in the chat (posting its card) and opens it. */
export function NewChatDocumentDialog({
  channelId,
  open,
  onClose,
}: {
  channelId: Id<"channels">;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("docs");
  const create = useMutation(api.documents.createInChat);
  return (
    <NewDocumentDialog
      key={String(open)}
      open={open}
      description={t("newInChatBody")}
      onClose={onClose}
      onCreate={(title) => create({ channelId, title })}
    />
  );
}

/** Every shared document of the chat, including ones whose card has expired with the chat history. */
export function ChatDocumentsDialog({
  channelId,
  open,
  onOpenChange,
}: {
  channelId: Id<"channels">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("docs");
  const data = useQuery(api.documents.listForChat, open ? { channelId } : "skip");
  const [creating, setCreating] = useState(false);
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("chatDocsTitle")}</DialogTitle>
            <DialogDescription>{t("chatDocsBody")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {data === undefined ? <Skeleton className="h-10" /> : <DocumentRows documents={data?.documents ?? []} />}
          </div>
          {data?.canCreate ? (
            <DialogFooter>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  setCreating(true);
                }}
              >
                <PlusIcon />
                {t("new")}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
      <NewChatDocumentDialog channelId={channelId} open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
