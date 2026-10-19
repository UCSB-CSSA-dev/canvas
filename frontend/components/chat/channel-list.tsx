"use client";

import { HashIcon, MegaphoneIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LIMITS } from "@/lib/api";
import type { Locale } from "@/lib/locale-store";
import { cn } from "@/lib/utils";
import { NewDmDialog } from "./new-dm-dialog";
import { channelName, type Channel, type ChannelLists } from "./types";

export function ChannelList({ lists, activeId }: { lists: ChannelLists; activeId: string | null }) {
  const t = useTranslations("chat");
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-4 p-2">
        <Section title={t("sectionGeneral")}>
          {lists.org.map((c) => (
            <ChannelItem key={c._id} channel={c} active={c._id === activeId} />
          ))}
        </Section>
        {lists.departments.length > 0 ? (
          <Section title={t("sectionDepartments")}>
            {lists.departments.map((c) => (
              <ChannelItem key={c._id} channel={c} active={c._id === activeId} />
            ))}
          </Section>
        ) : null}
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
            lists.dms.map((c) => <ChannelItem key={c._id} channel={c} active={c._id === activeId} />)
          )}
        </Section>
      </div>
    </ScrollArea>
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

function ChannelItem({ channel, active }: { channel: Channel; active: boolean }) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const name = channelName(channel, locale, t("general"));
  const unread = channel.unread;

  return (
    <Link
      href={`/chat/?c=${channel._id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        unread > 0 && !active && "font-medium text-foreground",
      )}
    >
      {channel.type === "dm" ? (
        <PersonAvatar person={channel.otherUser} className="size-5" />
      ) : channel.type === "org" ? (
        <MegaphoneIcon className="size-4 shrink-0" />
      ) : (
        <HashIcon className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {unread > 0 && !active ? (
        <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground">
          {unread > LIMITS.unreadCountCap ? `${LIMITS.unreadCountCap}+` : unread}
        </span>
      ) : null}
    </Link>
  );
}
