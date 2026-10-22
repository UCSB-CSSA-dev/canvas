"use client";

import { useMutation, useQuery } from "convex/react";
import { ChevronDownIcon, MegaphoneIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { useChat } from "./chat-context";
import { usePlainPreview } from "./markdown";
import { personById } from "./types";

/** Unacknowledged announcements, pinned under the chat header until the reader taps 知道了. */
export function AnnouncementBar() {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const { channel, jumpTo } = useChat();
  const markSeen = useMutation(api.channels.markAnnouncementsSeen);
  const showError = useErrorToast();
  const preview = usePlainPreview();
  const [index, setIndex] = useState(0);
  const watching = channel.access.via === "member" && channel.unseenAnnouncements > 0;
  const list = useQuery(api.channels.unseenAnnouncementList, watching ? { channelId: channel._id } : "skip");

  if (!watching || !list || list.length === 0) return null;
  const current = list[index % list.length];
  const author = personById(current.people, current.authorId);
  const count = Math.max(channel.unseenAnnouncements, list.length);

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm">
      <MegaphoneIcon className="size-4 shrink-0 text-warning" />
      <button
        type="button"
        onClick={() => jumpTo(current._id)}
        className="min-w-0 flex-1 truncate text-left hover:underline"
      >
        <span className="font-medium text-warning">
          {count > 1 ? t("unseenAnnouncements", { count }) : t("announcementTag")}
        </span>
        <span className="text-muted-foreground">
          {" · "}
          {displayName(author, locale) || t("unknownUser")}
          {locale === "zh" ? "：" : ": "}
        </span>
        {preview(current.body, current.people, 140) || t("attachmentOnly")}
      </button>
      {list.length > 1 ? (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("nextAnnouncement")}
          onClick={() => setIndex((i) => (i + 1) % list.length)}
        >
          <ChevronDownIcon />
        </Button>
      ) : null}
      <Button
        size="xs"
        variant="ghost"
        className="shrink-0 text-warning hover:bg-warning/15 hover:text-warning"
        onClick={() => markSeen({ channelId: channel._id }).catch(showError)}
      >
        {t("acknowledge")}
      </Button>
    </div>
  );
}
