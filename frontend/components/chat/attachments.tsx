"use client";

import { DownloadIcon, FileIcon, FileXIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { LIMITS } from "@/lib/api";
import type { Message } from "./types";

type Attachment = Message["attachments"][number];

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <AttachmentItem key={a._id} attachment={a} />
      ))}
    </div>
  );
}

function AttachmentItem({ attachment }: { attachment: Attachment }) {
  const t = useTranslations("chat");
  if (attachment.expired || !attachment.url) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        <FileXIcon className="size-4" />
        <span className="max-w-48 truncate">{attachment.name}</span>
        <span>· {t("fileExpired")}</span>
      </div>
    );
  }
  if (attachment.isImage && attachment.thumbUrl) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        title={t("openOriginal", { name: attachment.name, size: formatBytes(attachment.size) })}
        className="block overflow-hidden rounded-md border border-border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, thumbnails come from Convex storage */}
        <img src={attachment.thumbUrl} alt={attachment.name} className="max-h-48 max-w-64 object-cover" loading="lazy" />
      </a>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="max-w-56 truncate">{attachment.name}</div>
        <div className="text-xs text-muted-foreground">
          {formatBytes(attachment.size)} · {t("fileKeptDays", { days: LIMITS.attachmentRetentionDays })}
        </div>
      </div>
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        download={attachment.name}
        aria-label={t("download")}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <DownloadIcon className="size-4" />
      </a>
    </div>
  );
}
