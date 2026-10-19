"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Button } from "@/components/ui/button";
import { api, LIMITS } from "@/lib/api";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import type { Channel } from "./types";

type Message = FunctionReturnType<typeof api.messages.list>["page"][number];

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 120;
const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

export function MessageView({ channel }: { channel: Channel }) {
  const t = useTranslations("chat");
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { channelId: channel._id },
    { initialNumItems: LIMITS.messagesPageSize },
  );
  const messages = [...results].reverse();
  const markRead = useMutation(api.channels.markRead);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const heightBeforeLoad = useRef<number | null>(null);
  const newestId = messages.at(-1)?._id;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (heightBeforeLoad.current !== null) {
      el.scrollTop += el.scrollHeight - heightBeforeLoad.current;
      heightBeforeLoad.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [results.length, newestId]);

  useEffect(() => {
    if (channel.unread === 0) return;
    const timer = setTimeout(() => void markRead({ channelId: channel._id }).catch(() => undefined), 400);
    return () => clearTimeout(timer);
  }, [channel._id, channel.unread, markRead]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const loadOlder = () => {
    heightBeforeLoad.current = scrollRef.current?.scrollHeight ?? null;
    loadMore(LIMITS.messagesPageSize);
  };

  return (
    <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full flex-col justify-end px-4 py-3">
        {status === "CanLoadMore" || status === "LoadingMore" ? (
          <div className="mb-3 flex justify-center">
            <Button size="sm" variant="ghost" onClick={loadOlder} disabled={status === "LoadingMore"}>
              {t("loadOlder")}
            </Button>
          </div>
        ) : null}
        {status !== "LoadingFirstPage" && messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("noMessages")}</p>
        ) : null}
        <MessageList messages={messages} />
      </div>
    </div>
  );
}

function MessageList({ messages }: { messages: Message[] }) {
  const format = useFormatter();
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const newDay = !previous || !sameDay(previous._creationTime, message._creationTime);
    const grouped =
      !newDay &&
      previous.author?._id === message.author?._id &&
      message._creationTime - previous._creationTime < GROUP_WINDOW_MS;
    return (
      <Fragment key={message._id}>
        {newDay ? (
          <div className="my-3 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {format.dateTime(message._creationTime, { year: "numeric", month: "short", day: "numeric", weekday: "short" })}
            <div className="h-px flex-1 bg-border" />
          </div>
        ) : null}
        <MessageRow message={message} grouped={grouped} />
      </Fragment>
    );
  });
}

function MessageRow({ message, grouped }: { message: Message; grouped: boolean }) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const time = format.dateTime(message._creationTime, { hour: "numeric", minute: "2-digit" });

  if (grouped) {
    return (
      <div className="group flex gap-3 rounded-md py-0.5 hover:bg-surface-hover">
        <span className="w-8 shrink-0 pt-0.5 text-right text-[10px] text-transparent group-hover:text-subtle-foreground">
          {time}
        </span>
        <MessageBody body={message.body} />
      </div>
    );
  }
  return (
    <div className="mt-2 flex gap-3 rounded-md py-0.5 hover:bg-surface-hover">
      <PersonAvatar person={message.author} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">
            {message.author ? displayName(message.author, locale) : t("unknownUser")}
          </span>
          <span className="text-xs text-subtle-foreground">{time}</span>
        </div>
        <MessageBody body={message.body} />
      </div>
    </div>
  );
}

function MessageBody({ body }: { body: string }) {
  const parts: ReactNode[] = body.split(URL_PATTERN).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
  return <p className="min-w-0 text-sm break-words whitespace-pre-wrap">{parts}</p>;
}

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
