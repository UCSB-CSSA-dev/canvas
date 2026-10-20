"use client";

import { useQuery } from "convex/react";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  EyeIcon,
  HashIcon,
  MegaphoneIcon,
  PlusIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useViewer } from "@/components/auth/account-state";
import { GroupFormDialog } from "@/components/groups/group-form-dialog";
import { ProposalsDialog } from "@/components/groups/proposals-dialog";
import { PersonAvatar } from "@/components/people/person-avatar";
import { PersonPicker } from "@/components/people/person-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, LIMITS, type Id } from "@/lib/api";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { NewDmDialog } from "./new-dm-dialog";
import type { Channel, ChannelLists } from "./types";
import { useChannelName } from "./use-channel-name";

export function ChannelList({ lists, activeId }: { lists: ChannelLists; activeId: string | null }) {
  const t = useTranslations("chat");
  const viewer = useViewer();
  const params = useSearchParams();
  const [proposalsOpen, setProposalsOpen] = useState(params.get("proposals") === "1");
  const canOversee = viewer.isAdmin || viewer.ledDepartmentIds.length > 0;
  const href = (id: string) => `/chat/?c=${id}`;
  const item = (c: Channel) => <ChannelItem key={c._id} channel={c} active={c._id === activeId} href={href(c._id)} />;

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-4 p-2">
        {lists.announcements.length > 0 ? (
          <Section title={t("sectionAnnouncements")}>{lists.announcements.map(item)}</Section>
        ) : null}
        <Section title={t("sectionGeneral")}>{lists.org.map(item)}</Section>
        {lists.departments.length > 0 ? (
          <Section title={t("sectionDepartments")}>{lists.departments.map(item)}</Section>
        ) : null}
        <Section
          title={t("sectionGroups")}
          action={
            <span className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="relative"
                    aria-label={t("groupProposals")}
                    onClick={() => setProposalsOpen(true)}
                  >
                    <ClipboardListIcon />
                    {viewer.pendingGroupCount > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
                    ) : null}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("groupProposals")}</TooltipContent>
              </Tooltip>
              <GroupFormDialog>
                <Button size="icon-xs" variant="ghost" aria-label={t("newGroup")}>
                  <PlusIcon />
                </Button>
              </GroupFormDialog>
            </span>
          }
        >
          {viewer.pendingGroupCount > 0 ? (
            <button
              type="button"
              onClick={() => setProposalsOpen(true)}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-primary hover:bg-accent"
            >
              <ClipboardListIcon className="size-3.5" />
              {t("pendingGroups", { count: viewer.pendingGroupCount })}
            </button>
          ) : null}
          {lists.groups.length === 0 ? (
            <p className="px-2.5 py-1 text-xs text-muted-foreground">{t("noGroups")}</p>
          ) : (
            lists.groups.map(item)
          )}
        </Section>
        <Section
          title={t("sectionDms")}
          action={
            <NewDmDialog>
              <Button size="icon-xs" variant="ghost" aria-label={t("newDm")}>
                <PlusIcon />
              </Button>
            </NewDmDialog>
          }
        >
          {lists.dms.length === 0 ? (
            <p className="px-2.5 py-1 text-xs text-muted-foreground">{t("noDms")}</p>
          ) : (
            lists.dms.map(item)
          )}
        </Section>
        {canOversee ? <OversightSection /> : null}
      </div>
      <ProposalsDialog open={proposalsOpen} onOpenChange={setProposalsOpen} />
    </ScrollArea>
  );
}

/** Collapsed entry for admins and 部长: pick a person to read their chats. */
function OversightSection() {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  return (
    <Section title={t("sectionOversight")}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <EyeIcon className="size-4 shrink-0 text-primary/80" />
        <span className="flex-1">{t("oversightPick")}</span>
        <ChevronRightIcon className="size-4" />
      </button>
      <OversightPicker open={open} onOpenChange={setOpen} />
    </Section>
  );
}

function OversightPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("chat");
  const router = useRouter();
  const people = useQuery(api.channels.oversightPeople, open ? {} : "skip");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("oversightPickTitle")}</DialogTitle>
          <DialogDescription>{t("oversightPickHint")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <PersonPicker
            people={people}
            onPick={(person) => {
              onOpenChange(false);
              router.push(`/chat/?oversee=${person._id}`);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Left column while overseeing one person: their chats the viewer can only read through oversight. */
export function OversightList({ userId, activeId }: { userId: Id<"users">; activeId: string | null }) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const channels = useQuery(api.channels.oversightChannels, { userId });
  const person = useQuery(api.channels.oversightPeople)?.find((p) => p._id === userId);
  const href = (id: string) => `/chat/?oversee=${userId}&c=${id}`;
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button asChild size="icon-sm" variant="ghost" aria-label={t("exitOversight")}>
          <Link href="/chat/">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <EyeIcon className="size-4 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm">
          {t("overseeing", { name: person ? displayName(person, locale) : "…" })}
        </span>
      </div>
      <p className="border-b border-border bg-primary/5 px-3 py-2 text-xs text-muted-foreground">{t("oversightLogged")}</p>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {channels === null ? (
            <p className="px-2.5 py-1 text-xs text-muted-foreground">{t("oversightForbidden")}</p>
          ) : channels && channels.length === 0 ? (
            <p className="px-2.5 py-1 text-xs text-muted-foreground">{t("oversightNone")}</p>
          ) : null}
          {(channels ?? []).map((c) => (
            <ChannelItem key={c._id} channel={c} active={c._id === activeId} href={href(c._id)} />
          ))}
        </div>
      </ScrollArea>
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-0.5">
      <div className="flex h-6 items-center justify-between px-2.5">
        <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChannelItem({ channel, active, href }: { channel: Channel; active: boolean; href: string }) {
  const t = useTranslations("chat");
  const name = useChannelName()(channel);
  const unread = channel.unread;
  const inactive = channel.ended || channel.archived;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        unread > 0 && !active && !channel.muted && "font-medium text-foreground",
        inactive && "opacity-60",
      )}
    >
      <ChannelIcon channel={channel} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {inactive ? <span className="text-[10px]">{channel.ended ? t("endedTag") : t("archivedTag")}</span> : null}
      {unread > 0 && !active ? (
        channel.muted ? (
          <span className="size-2 rounded-full bg-muted-foreground" aria-label={t("unreadMuted")} />
        ) : (
          <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground">
            {unread > LIMITS.unreadCountCap ? `${LIMITS.unreadCountCap}+` : unread}
          </span>
        )
      ) : null}
    </Link>
  );
}

function ChannelIcon({ channel }: { channel: Channel }) {
  switch (channel.type) {
    case "dm":
      return channel.otherUser ? (
        <PersonAvatar person={channel.otherUser} className="size-5" />
      ) : (
        <UsersRoundIcon className="size-4 shrink-0" />
      );
    case "announcement":
      return <MegaphoneIcon className="size-4 shrink-0" />;
    case "group":
      return <UsersRoundIcon className="size-4 shrink-0" />;
    default:
      return <HashIcon className="size-4 shrink-0" />;
  }
}
