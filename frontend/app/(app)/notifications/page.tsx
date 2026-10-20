"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { CheckCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/app-shell";
import { useNotificationText, type Notification } from "@/components/notifications/notification-text";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const { results, status, loadMore } = usePaginatedQuery(api.notifications.listMine, {}, { initialNumItems: PAGE_SIZE });
  const markAllRead = useMutation(api.notifications.markAllRead);
  const showError = useErrorToast();
  const hasUnread = results.some((n) => !n.readAt);

  return (
    <>
      <PageHeader title={t("title")}>
        <Button size="sm" variant="ghost" disabled={!hasUnread} onClick={() => markAllRead().catch(showError)}>
          <CheckCheckIcon />
          <span className="hidden sm:inline">{t("markAllRead")}</span>
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-1 p-4">
          {status === "LoadingFirstPage" ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)
          ) : results.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            results.map((n) => <NotificationRow key={n._id} notification={n} />)
          )}
          {status === "CanLoadMore" ? (
            <Button variant="ghost" size="sm" className="self-center" onClick={() => loadMore(PAGE_SIZE)}>
              {t("loadMore")}
            </Button>
          ) : null}
          {results.length > 0 && status === "Exhausted" ? (
            <p className="py-4 text-center text-xs text-subtle-foreground">{t("retentionHint")}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}

function NotificationRow({ notification: n }: { notification: Notification }) {
  const router = useRouter();
  const format = useFormatter();
  const text = useNotificationText()(n);
  const markRead = useMutation(api.notifications.markRead);
  const unread = !n.readAt;
  const actor = n.people[0];

  const open = () => {
    if (unread) void markRead({ notificationId: n._id }).catch(() => undefined);
    if (n.link) router.push(n.link);
  };

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent",
        unread && "bg-primary/5",
      )}
    >
      <PersonAvatar person={actor} className="mt-0.5 size-8" />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", unread ? "font-medium" : "text-muted-foreground")}>{text.title}</span>
        {text.detail ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{text.detail}</span> : null}
        <span className="mt-1 block text-xs text-subtle-foreground">{format.relativeTime(n._creationTime)}</span>
      </span>
      {unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" /> : null}
    </button>
  );
}
