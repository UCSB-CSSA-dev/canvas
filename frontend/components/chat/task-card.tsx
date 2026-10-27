"use client";

import { CalendarDaysIcon, ChevronRightIcon, ClipboardListIcon, FileXIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatBytes } from "@/lib/format";
import { FileTypeIcon } from "@/components/files/file-icon";
import { SubmissionBadge, TaskStatusBadge, useTaskWhen } from "@/components/tasks/task-format";
import type { Locale } from "@/lib/locale-store";
import { localized } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { Message } from "./types";

type TaskCard = NonNullable<Message["task"]>;
type SharedFile = Message["files"][number];

export function TaskCardView({ task }: { task: Message["task"] }) {
  const t = useTranslations("tasks");
  const when = useTaskWhen();
  if (!task) {
    return <p className="text-sm text-muted-foreground italic">{t("cardGone")}</p>;
  }
  const isEvent = task.kind === "event";
  const Icon = isEvent ? CalendarDaysIcon : ClipboardListIcon;
  return (
    <Link
      href={`/assignments/view/?a=${task._id}`}
      className="mt-1 flex max-w-md flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
    >
      <div className="flex items-center gap-2 text-xs text-primary">
        <Icon className="size-4" />
        <span className="font-medium">{isEvent ? t("kindEvent") : t("kindTask")}</span>
        <TaskStatusBadge status={task.status} ended={task.ended} />
        <ChevronRightIcon className="ml-auto size-4 text-muted-foreground" />
      </div>
      <div className="text-sm font-semibold">{task.title}</div>
      <div className="text-xs text-muted-foreground">{when(task)}</div>
      <CardFooter task={task} />
    </Link>
  );
}

function CardFooter({ task }: { task: TaskCard }) {
  const t = useTranslations("tasks");
  if (task.kind === "event") {
    return <div className="text-xs text-muted-foreground">{t("helpersCount", { count: task.assigneeCount })}</div>;
  }
  const ratio = task.assigneeCount > 0 ? task.doneCount / task.assigneeCount : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{t("progress", { done: task.doneCount, total: task.assigneeCount })}</span>
      {task.myStatus ? <SubmissionBadge status={task.myStatus} /> : null}
    </div>
  );
}

/** Files shared from a space: a link to the file page, which checks access again. */
export function SharedFileList({ files }: { files: SharedFile[] }) {
  if (files.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {files.map((file) => (
        <SharedFileCard key={file._id} file={file} />
      ))}
    </div>
  );
}

function SharedFileCard({ file }: { file: SharedFile }) {
  const t = useTranslations("files");
  const locale = useLocale() as Locale;
  const space = localized(file.spaceNameZh, file.spaceNameEn, locale);
  const unavailable = file.deleted || !file.canView;
  const body = (
    <>
      {file.deleted ? (
        <FileXIcon className="size-5 shrink-0 text-muted-foreground" />
      ) : !file.canView ? (
        <LockIcon className="size-5 shrink-0 text-muted-foreground" />
      ) : (
        <FileTypeIcon contentType={file.contentType} name={file.name} />
      )}
      <div className="min-w-0">
        <div className="max-w-56 truncate">{file.name}</div>
        <div className="text-xs text-muted-foreground">
          {file.deleted ? t("sharedDeleted") : !file.canView ? t("sharedNoAccess", { space }) : `${formatBytes(file.size)} · ${space}`}
        </div>
      </div>
    </>
  );
  const className = cn(
    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
    unavailable ? "border-dashed border-border text-muted-foreground" : "border-border bg-secondary/40 hover:bg-secondary",
  );
  if (unavailable) return <div className={className}>{body}</div>;
  return (
    <Link href={`/files/?s=${file.spaceKey}&file=${file._id}`} className={className}>
      {body}
    </Link>
  );
}
