"use client";

import { createContext, useContext } from "react";
import type { Id } from "@/lib/api";
import type { ChannelDetail, Message } from "./types";

export type ChatState = {
  channel: ChannelDetail;
  replyTo: Message | null;
  setReplyTo: (message: Message | null) => void;
  editing: Message | null;
  setEditing: (message: Message | null) => void;
  selecting: boolean;
  selected: Map<Id<"messages">, Message>;
  toggleSelected: (message: Message) => void;
  startSelecting: (message?: Message) => void;
  stopSelecting: () => void;
  forward: (ids: Id<"messages">[]) => void;
  showHistory: (message: Message) => void;
  /** Jump to a message (from a reply quote or search), loading the messages around it. */
  jumpTo: (messageId: Id<"messages">) => void;
};

export const ChatContext = createContext<ChatState | null>(null);

export function useChat() {
  const state = useContext(ChatContext);
  if (!state) throw new Error("useChat outside ChatContext");
  return state;
}
