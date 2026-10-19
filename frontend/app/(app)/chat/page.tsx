"use client";

import { useQuery } from "convex/react";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";
import { ChannelList } from "@/components/chat/channel-list";
import { Composer } from "@/components/chat/composer";
import { MessageView } from "@/components/chat/message-view";
import { channelName } from "@/components/chat/types";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Locale } from "@/lib/locale-store";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}

function Chat() {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const requestedId = useSearchParams().get("c");
  const lists = useQuery(api.channels.listMine);

  const all = lists ? [...lists.org, ...lists.departments, ...lists.dms] : [];
  // Desktop falls back to the org channel; mobile shows the list until one is picked.
  const active = all.find((c) => c._id === requestedId) ?? (lists?.org[0] ?? null);
  const showConversationOnMobile = requestedId !== null && active?._id === requestedId;

  return (
    <div className="flex min-h-0 flex-1">
      <div
        className={cn(
          "min-h-0 w-full flex-col border-r border-border md:flex md:w-64",
          showConversationOnMobile ? "hidden" : "flex",
        )}
      >
        <PageHeader title={t("title")} />
        {lists ? <ChannelList lists={lists} activeId={active?._id ?? null} /> : null}
      </div>
      <section
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col md:flex",
          showConversationOnMobile ? "flex" : "hidden",
        )}
      >
        {active ? (
          <>
            <PageHeader
              title={
                <span className="flex items-center gap-2">
                  <Button asChild size="icon-sm" variant="ghost" className="md:hidden" aria-label={t("title")}>
                    <Link href="/chat/">
                      <ArrowLeftIcon />
                    </Link>
                  </Button>
                  {channelName(active, locale, t("general"))}
                </span>
              }
            />
            <MessageView key={active._id} channel={active} />
            <Composer
              key={`composer-${active._id}`}
              channelId={active._id}
              channelLabel={channelName(active, locale, t("general"))}
            />
          </>
        ) : (
          <p className="m-auto text-sm text-muted-foreground">{lists ? t("selectChannel") : null}</p>
        )}
      </section>
    </div>
  );
}
