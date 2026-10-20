"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppBar } from "@/components/apps/app-bar";
import { AppPanel, EndedAppsDialog } from "@/components/apps/app-panel";
import { GroupInfoSheet } from "@/components/groups/group-info-sheet";
import { api, LIMITS, type Id } from "@/lib/api";
import { ChatContext, type ChatState } from "./chat-context";
import { ForwardDialog, HistoryDialog, RetentionDialog, SearchSheet, SelectionBar } from "./chat-dialogs";
import { ChatHeader } from "./chat-header";
import { Composer } from "./composer";
import { MessageView } from "./message-view";
import type { ChannelDetail, Message } from "./types";
import { useChannelName } from "./use-channel-name";

export function ChatRoom({
  channel,
  backHref,
  initialFocus,
  initialApp,
}: {
  channel: ChannelDetail;
  backHref: string;
  initialFocus: Id<"messages"> | null;
  initialApp: Id<"chatApps"> | null;
}) {
  const t = useTranslations("chat");
  const name = useChannelName()(channel);
  const recordOpen = useMutation(api.channels.recordOversightOpen);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Map<Id<"messages">, Message>>(new Map());
  const [forwarding, setForwarding] = useState<Id<"messages">[] | null>(null);
  const [history, setHistory] = useState<Message | null>(null);
  const [focusId, setFocusId] = useState(initialFocus);
  const [appId, setAppId] = useState(initialApp);
  const [searchOpen, setSearchOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [endedOpen, setEndedOpen] = useState(false);

  const oversight = channel.access.via === "oversight";
  useEffect(() => {
    if (oversight) void recordOpen({ channelId: channel._id }).catch(() => undefined);
  }, [oversight, channel._id, recordOpen]);

  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Map());
  }, []);

  const toggleSelected = useCallback(
    (message: Message) =>
      setSelected((prev) => {
        const next = new Map(prev);
        if (next.has(message._id)) next.delete(message._id);
        else if (next.size >= LIMITS.forwardMessages) {
          toast.error(t("selectLimit", { max: LIMITS.forwardMessages }));
          return prev;
        } else next.set(message._id, message);
        return next;
      }),
    [t],
  );

  const state = useMemo<ChatState>(
    () => ({
      channel,
      replyTo,
      setReplyTo: (message) => {
        setEditing(null);
        setReplyTo(message);
      },
      editing,
      setEditing: (message) => {
        setReplyTo(null);
        setEditing(message);
      },
      selecting,
      selected,
      toggleSelected,
      startSelecting: (message) => {
        setSelecting(true);
        setSelected(message ? new Map([[message._id, message]]) : new Map());
      },
      stopSelecting,
      forward: setForwarding,
      showHistory: setHistory,
      jumpTo: setFocusId,
    }),
    [channel, replyTo, editing, selecting, selected, toggleSelected, stopSelecting],
  );

  return (
    <ChatContext.Provider value={state}>
      <ChatHeader
        title={name}
        backHref={backHref}
        onSearch={() => setSearchOpen(true)}
        onRetention={() => setRetentionOpen(true)}
        onGroupInfo={() => setGroupOpen(true)}
        onEndedApps={() => setEndedOpen(true)}
      />
      <AppBar onOpen={setAppId} />
      <MessageView focusId={focusId} onLeaveFocus={() => setFocusId(null)} />
      {selecting ? <SelectionBar /> : <Composer placeholder={t("messagePlaceholder", { name })} />}

      <ForwardDialog
        messageIds={forwarding}
        onClose={(sent) => {
          setForwarding(null);
          if (sent) stopSelecting();
        }}
      />
      <HistoryDialog messageId={history?._id ?? null} people={history?.people ?? []} onClose={() => setHistory(null)} />
      <RetentionDialog open={retentionOpen} onOpenChange={setRetentionOpen} />
      <SearchSheet open={searchOpen} onOpenChange={setSearchOpen} />
      {channel.type === "group" ? (
        <GroupInfoSheet channelId={channel._id} open={groupOpen} onOpenChange={setGroupOpen} />
      ) : null}
      {channel.type !== "dm" ? (
        <EndedAppsDialog channelId={channel._id} open={endedOpen} onOpenChange={setEndedOpen} onOpenApp={setAppId} />
      ) : null}
      <AppPanel appId={appId} onClose={() => setAppId(null)} />
    </ChatContext.Provider>
  );
}
