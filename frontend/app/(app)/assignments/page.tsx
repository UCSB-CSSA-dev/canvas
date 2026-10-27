"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarDaysIcon, ClipboardListIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState, type ReactNode } from "react";
import { useViewer } from "@/components/auth/account-state";
import { PageHeader } from "@/components/layout/app-shell";
import {
  isOverdue,
  SubmissionBadge,
  TaskStatusBadge,
  useTaskChatName,
  useTaskWhen,
} from "@/components/tasks/task-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Item = FunctionReturnType<typeof api.assignments.listMine>[number];
type Tab = "mine" | "created" | "managed";

export default function AssignmentsPage() {
  return (
    <Suspense>
      <Assignments />
    </Suspense>
  );
}

function Assignments() {
  const t = useTranslations("tasks");
  const viewer = useViewer();
  const router = useRouter();
  const params = useSearchParams();
  const isManager = viewer.isAdmin || viewer.ledDepartmentIds.length > 0;
  const creatable = useQuery(api.assignments.creatableChannels, isManager ? {} : "skip");
  const canCreate = (creatable?.length ?? 0) > 0;
  const requested = params.get("tab") as Tab | null;
  const tabs: Tab[] = ["mine", ...(isManager ? (["created", "managed"] as Tab[]) : [])];
  const tab: Tab = requested && tabs.includes(requested) ? requested : "mine";

  return (
    <>
      <PageHeader title={t("title")}>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href="/assignments/new/">
              <PlusIcon />
              {t("new")}
            </Link>
          </Button>
        ) : null}
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
          {tabs.length > 1 ? (
            <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
              {tabs.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => router.replace(key === "mine" ? "/assignments/" : `/assignments/?tab=${key}`)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
                    tab === key ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`tab.${key}`)}
                </button>
              ))}
            </div>
          ) : null}
          {tab === "mine" ? <MineTab /> : tab === "created" ? <CreatedTab /> : <ManagedTab />}
        </div>
      </div>
    </>
  );
}

function MineTab() {
  const t = useTranslations("tasks");
  const items = useQuery(api.assignments.listMine);
  const [showDone, setShowDone] = useState(false);
  if (items === undefined) return <ListSkeleton />;
  const active = (i: Item) => i.status === "open" && !i.ended;
  const todo = items
    .filter((i) => active(i) && i.kind === "task" && (i.myStatus === "assigned" || i.myStatus === "changes_requested"))
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
  const events = items.filter((i) => active(i) && i.kind === "event").sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0));
  const waiting = items.filter((i) => active(i) && i.kind === "task" && i.myStatus === "submitted");
  const done = items.filter((i) => !todo.includes(i) && !events.includes(i) && !waiting.includes(i));
  if (items.length === 0) return <Empty>{t("emptyMine")}</Empty>;
  return (
    <>
      <Section title={t("section.todo")} count={todo.length} empty={t("allDone")}>
        {todo.map((item) => (
          <TaskRow key={item._id} item={item} mode="mine" />
        ))}
      </Section>
      {events.length > 0 ? (
        <Section title={t("section.events")} count={events.length}>
          {events.map((item) => (
            <TaskRow key={item._id} item={item} mode="mine" />
          ))}
        </Section>
      ) : null}
      {waiting.length > 0 ? (
        <Section title={t("section.waiting")} count={waiting.length}>
          {waiting.map((item) => (
            <TaskRow key={item._id} item={item} mode="mine" />
          ))}
        </Section>
      ) : null}
      {done.length > 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="self-start text-sm text-muted-foreground hover:text-foreground"
          >
            {showDone ? t("hideDone") : t("showDone", { count: done.length })}
          </button>
          {showDone ? (
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {done.map((item) => (
                <TaskRow key={item._id} item={item} mode="mine" />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function CreatedTab() {
  const t = useTranslations("tasks");
  const items = useQuery(api.assignments.listCreatedByMe);
  if (items === undefined) return <ListSkeleton />;
  if (items.length === 0) return <Empty>{t("emptyCreated")}</Empty>;
  const drafts = items.filter((i) => i.status === "draft");
  const open = items.filter((i) => i.status === "open");
  const closed = items.filter((i) => i.status === "closed");
  return (
    <>
      {drafts.length > 0 ? (
        <Section title={t("section.drafts")} count={drafts.length}>
          {drafts.map((item) => (
            <TaskRow key={item._id} item={item} mode="manage" />
          ))}
        </Section>
      ) : null}
      <Section title={t("section.open")} count={open.length} empty={t("noneOpen")}>
        {open.map((item) => (
          <TaskRow key={item._id} item={item} mode="manage" />
        ))}
      </Section>
      {closed.length > 0 ? (
        <Section title={t("section.closed")} count={closed.length}>
          {closed.map((item) => (
            <TaskRow key={item._id} item={item} mode="manage" />
          ))}
        </Section>
      ) : null}
    </>
  );
}

function ManagedTab() {
  const t = useTranslations("tasks");
  const items = useQuery(api.assignments.listManaged);
  if (items === undefined) return <ListSkeleton />;
  if (items.length === 0) return <Empty>{t("emptyManaged")}</Empty>;
  const review = items.filter((i) => i.toReview > 0);
  const rest = items.filter((i) => i.toReview === 0);
  return (
    <>
      {review.length > 0 ? (
        <Section title={t("section.toReview")} count={review.length}>
          {review.map((item) => (
            <TaskRow key={item._id} item={item} mode="manage" />
          ))}
        </Section>
      ) : null}
      <Section title={t("section.all")} count={rest.length}>
        {rest.map((item) => (
          <TaskRow key={item._id} item={item} mode="manage" />
        ))}
      </Section>
    </>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="text-subtle-foreground">{count}</span>
      </h2>
      {count === 0 && empty ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">{children}</div>
      )}
    </section>
  );
}

function TaskRow({ item, mode }: { item: Item; mode: "mine" | "manage" }) {
  const t = useTranslations("tasks");
  const when = useTaskWhen();
  const chatName = useTaskChatName();
  const [now] = useState(() => Date.now());
  const overdue = mode === "mine" && isOverdue(item, item.myStatus, now);
  const Icon = item.kind === "event" ? CalendarDaysIcon : ClipboardListIcon;
  return (
    <Link href={`/assignments/view/?a=${item._id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-hover">
      <Icon className={cn("size-5 shrink-0", item.kind === "event" ? "text-primary" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.title}</span>
          <TaskStatusBadge status={item.status} ended={item.ended} />
        </div>
        <div className={cn("truncate text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
          {[chatName(item.channel), overdue ? t("overdue") : null, when(item)].filter(Boolean).join(" · ")}
        </div>
      </div>
      {mode === "mine" ? (
        item.kind === "task" && item.myStatus ? (
          <SubmissionBadge status={item.myStatus} late={item.late} />
        ) : null
      ) : item.status === "draft" ? null : (
        <div className="flex shrink-0 items-center gap-2">
          {item.toReview > 0 ? <Badge>{t("toReviewCount", { count: item.toReview })}</Badge> : null}
          {item.kind === "task" ? (
            <span className="text-xs text-muted-foreground">{t("progress", { done: item.done, total: item.total })}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("helpersCount", { count: item.total })}</span>
          )}
        </div>
      )}
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
      <ClipboardListIcon className="size-8 text-subtle-foreground" />
      {children}
    </div>
  );
}
