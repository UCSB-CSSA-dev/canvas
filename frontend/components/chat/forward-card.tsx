"use client";

import { MessagesSquareIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { AttachmentList } from "./attachments";
import { Markdown, usePlainPreview } from "./markdown";
import type { Message, Person } from "./types";
import { useChannelName } from "./use-channel-name";

type Forward = NonNullable<Message["forward"]>;

function useForwardTitle() {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const channelName = useChannelName();
  return (forward: Forward, people: Person[]) => {
    const { source } = forward;
    if (source.type === "dm") {
      const [a, b] = (source.userIds ?? []).map((id) => displayName(people.find((p) => p._id === id), locale));
      return t("forwardTitleDm", { a: a ?? "", b: b ?? "" });
    }
    return t("forwardTitle", {
      chat: channelName({ type: source.type, nameZh: source.nameZh, nameEn: source.nameEn, name: source.name }),
    });
  };
}

export function ForwardCard({ forward, people }: { forward: Forward; people: Person[] }) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const title = useForwardTitle()(forward, people);
  const preview = usePlainPreview();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full max-w-sm flex-col gap-1 rounded-md border border-border bg-secondary/40 p-2.5 text-left hover:bg-secondary/70"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <MessagesSquareIcon className="size-4 text-primary" />
          <span className="truncate">{title}</span>
        </span>
        {forward.items.slice(0, 3).map((item, i) => (
          <span key={i} className="truncate text-xs text-muted-foreground">
            {displayName(people.find((p) => p._id === item.authorId), locale)}：
            {item.forward ? t("forwardNested") : preview(item.body, people, 60) || t("attachmentOnly")}
          </span>
        ))}
        <span className="border-t border-border pt-1 text-[11px] text-subtle-foreground">
          {t("forwardCount", { count: forward.items.length })}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <ForwardItems forward={forward} people={people} />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ForwardItems({ forward, people }: { forward: Forward; people: Person[] }) {
  const locale = useLocale() as Locale;
  const format = useFormatter();
  return (
    <div className="flex flex-col gap-3 pr-3">
      {forward.items.map((item, i) => {
        const author = people.find((p) => p._id === item.authorId);
        return (
          <div key={i} className="flex gap-2.5">
            <PersonAvatar person={author} className="size-7" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{displayName(author, locale)}</span>
                <span className="text-xs text-subtle-foreground">
                  {format.dateTime(item.sentAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              {item.body ? <Markdown body={item.body} people={people} /> : null}
              <AttachmentList attachments={item.attachments} />
              {item.forward ? <ForwardCard forward={item.forward as Forward} people={people} /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
