"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/locale-store";
import { localized } from "@/lib/names";
import { cn } from "@/lib/utils";

export type SubmissionStatus = "assigned" | "submitted" | "changes_requested" | "approved";
export type TaskStatus = "draft" | "open" | "closed";

type Timed = {
  kind: "task" | "event";
  dueAt?: number;
  startAt?: number;
  endAt?: number;
  location?: string;
};

/** "截止 10月28日 周三 17:00" for tasks, "10月28日 18:00 – 21:00 · UCen" for events. */
export function useTaskWhen() {
  const t = useTranslations("tasks");
  const format = useFormatter();
  const when = (ms: number) =>
    format.dateTime(ms, { month: "short", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" });
  return (item: Timed) => {
    if (item.kind === "event") {
      if (!item.startAt) return "";
      const sameDay = item.endAt && new Date(item.endAt).toDateString() === new Date(item.startAt).toDateString();
      const end = item.endAt
        ? ` – ${sameDay ? format.dateTime(item.endAt, { hour: "numeric", minute: "2-digit" }) : when(item.endAt)}`
        : "";
      return `${when(item.startAt)}${end}${item.location ? ` · ${item.location}` : ""}`;
    }
    return item.dueAt ? t("dueAt", { time: when(item.dueAt) }) : t("noDue");
  };
}

type ChatSummary = { type: string; name?: string; nameZh?: string; nameEn?: string } | null;

export function useTaskChatName() {
  const t = useTranslations("tasks");
  const locale = useLocale() as Locale;
  return (channel: ChatSummary) => {
    if (!channel) return "";
    if (channel.type === "org") return t("generalChat");
    if (channel.type === "group") return channel.name ?? "";
    return localized(channel.nameZh ?? "", channel.nameEn ?? "", locale);
  };
}

export function isOverdue(item: { kind: "task" | "event"; dueAt?: number }, status: SubmissionStatus | null, now: number) {
  return item.kind === "task" && item.dueAt !== undefined && item.dueAt < now && (status === "assigned" || status === "changes_requested");
}

export function SubmissionBadge({ status, late, className }: { status: SubmissionStatus; late?: boolean; className?: string }) {
  const t = useTranslations("tasks");
  const tone =
    status === "approved"
      ? "border-success/40 bg-success/10 text-success"
      : status === "submitted"
        ? "border-primary/40 bg-primary/10 text-primary"
        : status === "changes_requested"
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-border text-muted-foreground";
  return (
    <Badge variant="outline" className={cn(tone, className)}>
      {t(`status.${status}`)}
      {late ? ` · ${t("late")}` : ""}
    </Badge>
  );
}

export function TaskStatusBadge({ status, ended }: { status: TaskStatus; ended?: boolean }) {
  const t = useTranslations("tasks");
  if (status === "open" && !ended) return null;
  return <Badge variant="secondary">{ended && status === "open" ? t("ended") : t(`taskStatus.${status}`)}</Badge>;
}

/** Value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(ms: number | undefined) {
  if (ms === undefined) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}
