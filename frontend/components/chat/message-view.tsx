"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  CopyIcon,
  CornerUpLeftIcon,
  ForwardIcon,
  ListChecksIcon,
  MegaphoneIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ShieldXIcon,
  SmilePlusIcon,
  Undo2Icon,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useViewer } from "@/components/auth/account-state";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, LIMITS, REACTIONS, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import { useHiddenMessages } from "@/lib/hidden-messages";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { AttachmentList } from "./attachments";
import { useChat } from "./chat-context";
import { ForwardCard } from "./forward-card";
import { Markdown, usePlainPreview } from "./markdown";
import { SystemMessage } from "./system-message";
import { SharedFileList, TaskCardView } from "./task-card";
import { personById, type Message } from "./types";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 120;

export function MessageView({
  focusId,
  onLeaveFocus,
}: {
  focusId: Id<"messages"> | null;
  onLeaveFocus: () => void;
}) {
  return focusId ? <AroundView focusId={focusId} onLeave={onLeaveFocus} /> : <LatestView />;
}

function LatestView() {
  const t = useTranslations("chat");
  const { channel } = useChat();
  const viewer = useViewer();
  const { hidden } = useHiddenMessages(viewer._id);
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { channelId: channel._id },
    { initialNumItems: LIMITS.messagesPageSize },
  );
  const messages = [...results].reverse().filter((m) => !hidden.has(m._id));
  const markRead = useMutation(api.channels.markRead);
  const isMember = channel.access.via === "member";

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const heightBeforeLoad = useRef<number | null>(null);
  const newestId = results[0]?._id;

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
    if (!isMember || channel.unread === 0) return;
    const timer = setTimeout(() => void markRead({ channelId: channel._id }).catch(() => undefined), 400);
    return () => clearTimeout(timer);
  }, [channel._id, channel.unread, isMember, markRead, newestId]);

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
        ) : status === "Exhausted" && messages.length > 0 ? (
          <p className="mb-3 text-center text-xs text-subtle-foreground">
            {t("retentionHint", { days: channel.retentionDays })}
          </p>
        ) : null}
        {status !== "LoadingFirstPage" && messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("noMessages")}</p>
        ) : null}
        <MessageList messages={messages} highlightId={null} />
      </div>
    </div>
  );
}

function AroundView({ focusId, onLeave }: { focusId: Id<"messages">; onLeave: () => void }) {
  const t = useTranslations("chat");
  const { channel } = useChat();
  const viewer = useViewer();
  const { hidden } = useHiddenMessages(viewer._id);
  const data = useQuery(api.messages.around, { channelId: channel._id, messageId: focusId });
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  useLayoutEffect(() => {
    if (!data || scrolled.current) return;
    const el = scrollRef.current?.querySelector(`[data-message-id="${focusId}"]`);
    el?.scrollIntoView({ block: "center" });
    scrolled.current = true;
  }, [data, focusId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-1.5 text-xs text-muted-foreground">
        <span>{t("viewingHistory")}</span>
        <Button size="xs" variant="ghost" onClick={onLeave}>
          {t("backToLatest")}
        </Button>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-end px-4 py-3">
          {data === undefined ? null : data === null ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("messageExpired")}</p>
          ) : (
            <MessageList messages={data.messages.filter((m) => !hidden.has(m._id))} highlightId={focusId} />
          )}
        </div>
      </div>
    </div>
  );
}

function MessageList({ messages, highlightId }: { messages: Message[]; highlightId: Id<"messages"> | null }) {
  const format = useFormatter();
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const newDay = !previous || !sameDay(previous._creationTime, message._creationTime);
    const grouped =
      !newDay &&
      previous.kind !== "system" &&
      message.kind !== "system" &&
      !previous.announcement &&
      !message.announcement &&
      previous.authorId === message.authorId &&
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
        {message.kind === "system" ? (
          <SystemMessage message={message} />
        ) : (
          <MessageRow message={message} grouped={grouped} highlighted={message._id === highlightId} />
        )}
      </Fragment>
    );
  });
}

function MessageRow({ message, grouped, highlighted }: { message: Message; grouped: boolean; highlighted: boolean }) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const { selecting, selected, toggleSelected } = useChat();
  const author = personById(message.people, message.authorId);
  const time = format.dateTime(message._creationTime, { hour: "numeric", minute: "2-digit" });
  const selectable = message.state === "normal" && message.kind !== "task";
  const isSelected = selected.has(message._id);

  return (
    <div
      data-message-id={message._id}
      onClick={selecting && selectable ? () => toggleSelected(message) : undefined}
      className={cn(
        "group relative flex gap-3 rounded-md py-0.5 pr-2 hover:bg-surface-hover",
        !grouped && "mt-2",
        message.announcement &&
          message.state === "normal" &&
          "-ml-2 border-l-2 border-warning bg-warning/5 py-1.5 pl-1.5 hover:bg-warning/10",
        highlighted && "bg-primary/10 ring-1 ring-primary/40",
        selecting && selectable && "cursor-pointer",
        isSelected && "bg-primary/10",
      )}
    >
      {selecting ? (
        <div className="flex w-5 shrink-0 items-start pt-1.5">
          {selectable ? <Checkbox checked={isSelected} aria-label={t("select")} /> : null}
        </div>
      ) : null}
      {grouped ? (
        <span className="w-8 shrink-0 pt-0.5 text-right text-[10px] text-transparent group-hover:text-subtle-foreground">
          {time}
        </span>
      ) : (
        <PersonAvatar person={author} className="mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        {grouped ? null : (
          <div className="flex items-baseline gap-2">
            <span className={cn("text-sm font-medium", author?.status === "deactivated" && "text-muted-foreground line-through")}>
              {author ? displayName(author, locale) : t("unknownUser")}
            </span>
            {message.announcement && message.state === "normal" ? (
              <span className="flex items-center gap-1 self-center rounded-sm bg-warning/15 px-1.5 text-[11px] leading-4.5 font-medium text-warning">
                <MegaphoneIcon className="size-3" />
                {t("announcementTag")}
              </span>
            ) : null}
            <span className="text-xs text-subtle-foreground">{time}</span>
          </div>
        )}
        <MessageContent message={message} />
      </div>
      {!selecting && message.state === "normal" ? <MessageActions message={message} /> : null}
    </div>
  );
}

function MessageContent({ message }: { message: Message }) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const { showHistory } = useChat();
  const author = personById(message.people, message.authorId);

  if (message.state === "recalled") {
    return (
      <p className="text-sm text-muted-foreground italic">
        {t("recalled", { name: displayName(author, locale) || t("unknownUser") })}
      </p>
    );
  }
  if (message.state === "removed") {
    return <p className="text-sm text-muted-foreground italic">{t("removedByPresidium")}</p>;
  }
  return (
    <>
      {message.replyTo ? <ReplyQuote message={message} /> : null}
      {message.kind === "task" ? <TaskCardView task={message.task ?? null} /> : null}
      {message.body ? <Markdown body={message.body} people={message.people} /> : null}
      {message.forward ? <ForwardCard forward={message.forward} people={message.people} /> : null}
      <AttachmentList attachments={message.attachments} />
      <SharedFileList files={message.files} />
      {message.editedAt ? (
        <button
          type="button"
          onClick={() => showHistory(message)}
          className="text-[11px] text-subtle-foreground hover:text-foreground hover:underline"
        >
          {t("edited")}
        </button>
      ) : null}
      <Reactions message={message} />
    </>
  );
}

function ReplyQuote({ message }: { message: Message }) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const { jumpTo } = useChat();
  const preview = usePlainPreview();
  const reply = message.replyTo!;
  const author = personById(message.people, reply.authorId);
  const text =
    reply.state === "normal"
      ? preview(reply.body, message.people, 100) || t("attachmentOnly")
      : reply.state === "recalled"
        ? t("originalRecalled")
        : reply.state === "removed"
          ? t("originalRemoved")
          : t("originalExpired");
  return (
    <button
      type="button"
      disabled={reply.state === "missing"}
      onClick={() => jumpTo(reply._id)}
      className="mb-1 flex max-w-full items-center gap-1.5 border-l-2 border-primary/50 pl-2 text-left text-xs text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground"
    >
      <CornerUpLeftIcon className="size-3 shrink-0" />
      {author ? <span className="shrink-0 font-medium">{displayName(author, locale)}</span> : null}
      <span className="truncate">{text}</span>
    </button>
  );
}

function Reactions({ message }: { message: Message }) {
  const locale = useLocale() as Locale;
  const { channel } = useChat();
  const toggle = useMutation(api.messages.toggleReaction);
  const showError = useErrorToast();
  const canReact = channel.access.via === "member" && channel.access.canInteract;
  if (message.reactions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {message.reactions.map((r) => (
        <Tooltip key={r.emoji}>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!canReact}
              onClick={() => toggle({ messageId: message._id, emoji: r.emoji }).catch(showError)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs",
                r.mine ? "border-primary/60 bg-primary/15" : "border-border bg-secondary/40 hover:bg-secondary",
              )}
            >
              <span>{r.emoji}</span>
              <span>{r.count}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {r.userIds.map((id) => displayName(personById(message.people, id), locale)).join(locale === "zh" ? "、" : ", ")}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function ReactionPicker({ message }: { message: Message }) {
  const t = useTranslations("chat");
  const toggle = useMutation(api.messages.toggleReaction);
  const showError = useErrorToast();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost" aria-label={t("react")}>
          <SmilePlusIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto gap-1 p-1.5" align="end">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="rounded-md p-1 text-lg leading-none hover:bg-accent"
            onClick={() => {
              setOpen(false);
              toggle({ messageId: message._id, emoji }).catch(showError);
            }}
          >
            {emoji}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function MessageActions({ message }: { message: Message }) {
  const t = useTranslations("chat");
  const viewer = useViewer();
  const { channel, setReplyTo, setEditing, startSelecting, forward } = useChat();
  const recall = useMutation(api.messages.recall);
  const remove = useMutation(api.messages.remove);
  const showError = useErrorToast();
  const preview = usePlainPreview();
  const [now, setNow] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isMember = channel.access.via === "member";
  const own = message.authorId === viewer._id;
  const canReact = isMember && channel.access.canInteract;
  const canReply = isMember && channel.access.canPost;
  const canEdit = own && isMember && channel.access.canInteract && message.kind === "user";
  const canRecall = own && isMember && channel.access.canInteract && now - message._creationTime < LIMITS.recallWindowMs;

  const copy = async () => {
    const text = message.body ? preview(message.body, message.people, 100_000) : "";
    await navigator.clipboard.writeText(text);
    toast.success(t("copied"));
  };

  return (
    <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-sm group-hover:flex has-[[data-state=open]]:flex">
      {canReact ? <ReactionPicker message={message} /> : null}
      {canReply ? (
        <Button size="icon-xs" variant="ghost" aria-label={t("reply")} onClick={() => setReplyTo(message)}>
          <CornerUpLeftIcon />
        </Button>
      ) : null}
      <DropdownMenu onOpenChange={(open) => open && setNow(Date.now())}>
        <DropdownMenuTrigger asChild>
          <Button size="icon-xs" variant="ghost" aria-label={t("more")}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit ? (
            <DropdownMenuItem onSelect={() => setEditing(message)}>
              <PencilIcon />
              {t("edit")}
            </DropdownMenuItem>
          ) : null}
          {canRecall ? (
            <DropdownMenuItem onSelect={() => recall({ messageId: message._id }).catch(showError)}>
              <Undo2Icon />
              {t("recall")}
            </DropdownMenuItem>
          ) : null}
          {isMember && message.kind !== "task" ? (
            <DropdownMenuItem onSelect={() => forward([message._id])}>
              <ForwardIcon />
              {t("forward")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => void copy()}>
            <CopyIcon />
            {t("copy")}
          </DropdownMenuItem>
          {message.kind !== "task" ? (
            <DropdownMenuItem onSelect={() => startSelecting(message)}>
              <ListChecksIcon />
              {t("select")}
            </DropdownMenuItem>
          ) : null}
          {channel.access.canModerate ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmRemove(true)}>
                <ShieldXIcon />
                {t("moderateRemove")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("moderateRemoveTitle")}</DialogTitle>
            <DialogDescription>{t("moderateRemoveBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmRemove(false);
                remove({ messageId: message._id }).catch(showError);
              }}
            >
              {t("moderateRemove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
