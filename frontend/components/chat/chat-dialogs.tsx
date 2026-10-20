"use client";

import { useMutation, useQuery } from "convex/react";
import { CopyIcon, ForwardIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, LIMITS, RETENTION_OPTIONS, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import { useHiddenMessages } from "@/lib/hidden-messages";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { useChat } from "./chat-context";
import { Markdown, usePlainPreview } from "./markdown";
import { personById, type Message } from "./types";
import { useChannelName } from "./use-channel-name";

/** Replaces the composer while messages are selected. */
export function SelectionBar() {
  const t = useTranslations("chat");
  const viewer = useViewer();
  const { channel, selected, stopSelecting, forward } = useChat();
  const { hide } = useHiddenMessages(viewer._id);
  const [confirmHide, setConfirmHide] = useState(false);
  const preview = usePlainPreview();
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const messages = [...selected.values()].sort((a, b) => a._creationTime - b._creationTime);
  const isMember = channel.access.via === "member";
  const none = messages.length === 0;

  const copy = async () => {
    const text = messages
      .map((m) => {
        const name = displayName(personById(m.people, m.authorId), locale);
        const time = format.dateTime(m._creationTime, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
        return `${name} ${time}\n${preview(m.body, m.people, 100_000) || t("attachmentOnly")}`;
      })
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success(t("copied"));
    stopSelecting();
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2.5">
      <span className="flex-1 text-sm text-muted-foreground">
        {t("selectedCount", { count: messages.length, max: LIMITS.forwardMessages })}
      </span>
      {isMember ? (
        <Button size="sm" variant="secondary" disabled={none} onClick={() => forward(messages.map((m) => m._id))}>
          <ForwardIcon />
          {t("forwardCombined")}
        </Button>
      ) : null}
      {isMember ? (
        <Button size="sm" variant="secondary" disabled={none} onClick={() => setConfirmHide(true)}>
          <Trash2Icon />
          {t("deleteLocally")}
        </Button>
      ) : null}
      <Button size="sm" variant="secondary" disabled={none} onClick={() => void copy()}>
        <CopyIcon />
        {t("copy")}
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label={t("cancel")} onClick={stopSelecting}>
        <XIcon />
      </Button>
      <Dialog open={confirmHide} onOpenChange={setConfirmHide}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteLocallyTitle", { count: messages.length })}</DialogTitle>
            <DialogDescription>{t("deleteLocallyBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmHide(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                hide(messages.map((m) => m._id));
                setConfirmHide(false);
                stopSelecting();
              }}
            >
              {t("deleteLocally")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ForwardDialog({
  messageIds,
  onClose,
}: {
  messageIds: Id<"messages">[] | null;
  onClose: (sent: boolean) => void;
}) {
  const t = useTranslations("chat");
  const { channel } = useChat();
  const targets = useQuery(api.channels.postable, messageIds ? {} : "skip");
  const forward = useMutation(api.messages.forward);
  const channelName = useChannelName();
  const showError = useErrorToast();
  const [picked, setPicked] = useState<Id<"channels">[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = (targets ?? []).filter((c) => channelName(c).toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: Id<"channels">) =>
    setPicked((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : list.length >= LIMITS.forwardTargets ? list : [...list, id],
    );

  const submit = async () => {
    if (!messageIds) return;
    setBusy(true);
    try {
      await forward({ sourceChannelId: channel._id, messageIds, targetChannelIds: picked });
      toast.success(t("forwarded"));
      setPicked([]);
      onClose(true);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={messageIds !== null} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("forwardTitleDialog", { count: messageIds?.length ?? 0 })}</DialogTitle>
          <DialogDescription>{t("forwardHint", { max: LIMITS.forwardTargets })}</DialogDescription>
        </DialogHeader>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchChats")} />
        <ScrollArea className="h-72 rounded-md border border-border">
          <div className="flex flex-col p-1">
            {filtered.map((c) => (
              <label key={c._id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <Checkbox checked={picked.includes(c._id)} onCheckedChange={() => toggle(c._id)} />
                <span className="truncate">{channelName(c)}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            {t("cancel")}
          </Button>
          <Button disabled={busy || picked.length === 0} onClick={() => void submit()}>
            {t("sendTo", { count: picked.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HistoryDialog({
  messageId,
  people,
  onClose,
}: {
  messageId: Id<"messages"> | null;
  people: Message["people"];
  onClose: () => void;
}) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const versions = useQuery(api.messages.history, messageId ? { messageId } : "skip");
  return (
    <Dialog open={messageId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editHistory")}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <ol className="flex flex-col gap-3 pr-3">
            {[...(versions ?? [])].reverse().map((v, i) => (
              <li key={i} className="rounded-md border border-border p-2.5">
                <div className="mb-1 text-xs text-muted-foreground">
                  {i === 0 ? t("currentVersion") : t("earlierVersion")} ·{" "}
                  {format.dateTime(v.at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
                <Markdown body={v.body} people={people} />
              </li>
            ))}
          </ol>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function RetentionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("chat");
  const { channel } = useChat();
  const setRetention = useMutation(api.channels.setRetention);
  const showError = useErrorToast();
  const [days, setDays] = useState(channel.retentionDays);
  const shortening = days < channel.retentionDays;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("retentionTitle")}</DialogTitle>
          <DialogDescription>{t("retentionBody")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {RETENTION_OPTIONS.map((option) => (
            <Button key={option} size="sm" variant={option === days ? "default" : "outline"} onClick={() => setDays(option)}>
              {t(`retention.${option}` as "retention.15")}
            </Button>
          ))}
        </div>
        {shortening ? <p className="text-sm text-destructive">{t("retentionShortenWarning", { days })}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant={shortening ? "destructive" : "default"}
            disabled={days === channel.retentionDays}
            onClick={() =>
              setRetention({ channelId: channel._id, days })
                .then(() => onOpenChange(false))
                .catch(showError)
            }
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SearchSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const { channel, jumpTo } = useChat();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const results = useQuery(api.messages.search, open && query ? { channelId: channel._id, query } : "skip");
  const preview = usePlainPreview();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-3 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("searchTitle")}</SheetTitle>
        </SheetHeader>
        <form
          className="flex gap-2 px-4"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(input.trim());
          }}
        >
          <Input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("searchPlaceholder")} />
          <Button type="submit" size="icon" aria-label={t("searchTitle")}>
            <SearchIcon />
          </Button>
        </form>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-1 px-4 pb-4">
            {query && results?.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("searchEmpty")}</p>
            ) : null}
            {(results ?? []).map((m) => {
              const author = personById(m.people, m.authorId);
              return (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => {
                    jumpTo(m._id);
                    onOpenChange(false);
                  }}
                  className="flex gap-2 rounded-md p-2 text-left hover:bg-accent"
                >
                  <PersonAvatar person={author} className="size-7" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-xs">
                      <span className="font-medium">{displayName(author, locale)}</span>
                      <span className="text-subtle-foreground">
                        {format.dateTime(m._creationTime, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className={cn("text-sm break-words")}>{highlight(preview(m.body, m.people, 200), query)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function highlight(text: string, query: string) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-primary/30 px-0.5 text-foreground">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}
