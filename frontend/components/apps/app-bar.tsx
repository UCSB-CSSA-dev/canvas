"use client";

import { useQuery } from "convex/react";
import { CalendarClockIcon, ListOrderedIcon, PlusIcon, VoteIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChat } from "@/components/chat/chat-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type Id } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CreateAppDialog } from "./create-app-dialog";

export const APP_ICONS: Record<"signup" | "poll" | "meeting", LucideIcon> = {
  signup: ListOrderedIcon,
  poll: VoteIcon,
  meeting: CalendarClockIcon,
};

const VISIBLE_CHIPS = 3;

/** Rounded chips under the chat header for running (and pending) 接龙 / 投票 / 集会. */
export function AppBar({ onOpen }: { onOpen: (appId: Id<"chatApps">) => void }) {
  const t = useTranslations("apps");
  const { channel } = useChat();
  const apps = useQuery(api.apps.list, channel.type === "dm" ? "skip" : { channelId: channel._id });
  if (!apps || channel.type === "dm") return null;

  const chips = [...apps.proposed, ...apps.running];
  const canStart = (apps.canCreate || apps.canPropose) && channel.access.via === "member" && !channel.access.readOnly;
  if (chips.length === 0 && !canStart) return null;
  const visible = chips.slice(0, VISIBLE_CHIPS);
  const hidden = chips.slice(VISIBLE_CHIPS);

  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-1.5">
      {visible.map((app) => {
        const Icon = APP_ICONS[app.kind];
        return (
          <button
            key={app._id}
            type="button"
            onClick={() => onOpen(app._id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              app.status === "proposed"
                ? "border-dashed border-primary/60 text-primary"
                : "border-border bg-secondary/40 hover:bg-secondary",
            )}
          >
            <Icon className="size-3.5" />
            <span>{t(`kind.${app.kind}`)}</span>
            <span className="max-w-32 truncate text-muted-foreground">· {app.title}</span>
            {app.status === "proposed" ? (
              <span>· {t("pendingApproval")}</span>
            ) : (
              <span className="text-muted-foreground">· {t("people", { count: app.responseCount })}</span>
            )}
          </button>
        );
      })}
      {hidden.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="xs" variant="ghost">
              {t("more", { count: hidden.length })}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {hidden.map((app) => (
              <DropdownMenuItem key={app._id} onSelect={() => onOpen(app._id)}>
                {t(`kind.${app.kind}`)} · {app.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {canStart ? (
        <CreateAppDialog canCreate={apps.canCreate} onCreated={onOpen}>
          <Button size="xs" variant="ghost" className="shrink-0 text-muted-foreground">
            <PlusIcon />
            {apps.canCreate ? t("start") : t("proposeApp")}
          </Button>
        </CreateAppDialog>
      ) : null}
    </div>
  );
}
