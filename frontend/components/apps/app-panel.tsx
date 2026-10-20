"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CopyIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useViewer } from "@/components/auth/account-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, LIMITS, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { APP_ICONS } from "./app-bar";
import { MeetingBody } from "./meeting-grid";

export type AppView = FunctionReturnType<typeof api.apps.get>;
type PollConfig = { options: string[]; multiple: boolean; maxChoices?: number; allowOther: boolean; anonymous: boolean; showResults: "live" | "after_vote" | "after_close" };
type SignupConfig = { example?: string; cap?: number };

export function AppPanel({ appId, onClose }: { appId: Id<"chatApps"> | null; onClose: () => void }) {
  return (
    <Sheet open={appId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">{appId ? <AppContent appId={appId} /> : null}</SheetContent>
    </Sheet>
  );
}

function AppContent({ appId }: { appId: Id<"chatApps"> }) {
  const t = useTranslations("apps");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const app = useQuery(api.apps.get, { appId });
  if (app === undefined) return null;
  const Icon = APP_ICONS[app.kind];
  const starter = app.people.find((p) => p._id === app.createdBy);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          {app.title}
        </SheetTitle>
        <SheetDescription>
          {t("meta", { kind: t(`kind.${app.kind}`), name: displayName(starter, locale) })}
          {app.deadline
            ? ` · ${t("deadlineAt", { time: format.dateTime(app.deadline, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) })}`
            : ""}
        </SheetDescription>
        <div className="flex gap-1.5">
          <Badge variant={app.status === "active" ? "default" : "secondary"}>{t(`status.${app.status}`)}</Badge>
        </div>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-4 pb-6">
          {app.description ? <p className="text-sm whitespace-pre-wrap text-muted-foreground">{app.description}</p> : null}
          {app.status === "rejected" && app.rejectReason ? (
            <p className="text-sm text-destructive">{t("rejectedReason", { reason: app.rejectReason })}</p>
          ) : null}
          {app.kind === "signup" ? <SignupBody app={app} /> : null}
          {app.kind === "poll" ? <PollBody app={app} /> : null}
          {app.kind === "meeting" ? <MeetingBody app={app} /> : null}
          <ManageActions app={app} />
        </div>
      </ScrollArea>
    </>
  );
}

function SignupBody({ app }: { app: AppView }) {
  const t = useTranslations("apps");
  const locale = useLocale() as Locale;
  const viewer = useViewer();
  const respond = useMutation(api.apps.respond);
  const withdraw = useMutation(api.apps.withdraw);
  const showError = useErrorToast();
  const config = app.config as SignupConfig;
  const mine = app.mine && "text" in app.mine ? app.mine.text : "";
  const [text, setText] = useState(mine);
  const entries = app.signup?.entries ?? [];
  const full = app.signup?.full === true && !app.mine;

  const copyText = async () => {
    const lines = [app.title, ...entries.map((e, i) => `${i + 1}. ${displayName(app.people.find((p) => p._id === e.userId), locale)} ${e.text}`)];
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success(t("copied"));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {config.cap ? t("signupCount", { count: entries.length, cap: config.cap }) : t("people", { count: entries.length })}
          {app.signup?.full ? <Badge className="ml-2">{t("full")}</Badge> : null}
        </span>
        <Button size="xs" variant="ghost" onClick={() => void copyText()}>
          <CopyIcon />
          {t("copyAsText")}
        </Button>
      </div>
      <ol className="flex flex-col gap-1">
        {entries.map((e, i) => (
          <li key={e.userId} className={cn("flex gap-2 rounded-md px-2 py-1 text-sm", e.userId === viewer._id && "bg-primary/10")}>
            <span className="w-6 shrink-0 text-right text-muted-foreground">{i + 1}.</span>
            <span className="shrink-0 font-medium">{displayName(app.people.find((p) => p._id === e.userId), locale)}</span>
            <span className="min-w-0 break-words text-muted-foreground">{e.text}</span>
          </li>
        ))}
      </ol>
      {app.viewer.canRespond ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Input
            value={text}
            maxLength={LIMITS.signupEntry}
            disabled={full}
            placeholder={config.example || t("signupPlaceholder")}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            {app.mine ? (
              <Button size="sm" variant="ghost" onClick={() => withdraw({ appId: app._id }).then(() => setText("")).catch(showError)}>
                {t("removeMine")}
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={!text.trim() || full}
              onClick={() => respond({ appId: app._id, data: { text } }).catch(showError)}
            >
              {app.mine ? t("update") : t("join")}
            </Button>
          </div>
          {full ? <p className="text-xs text-muted-foreground">{t("fullHint")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function PollBody({ app }: { app: AppView }) {
  const t = useTranslations("apps");
  const locale = useLocale() as Locale;
  const respond = useMutation(api.apps.respond);
  const withdraw = useMutation(api.apps.withdraw);
  const showError = useErrorToast();
  const config = app.config as PollConfig;
  const mine = app.mine && "choices" in app.mine ? app.mine : null;
  const [choices, setChoices] = useState<number[]>(mine?.choices ?? []);
  const [other, setOther] = useState(mine?.other ?? "");
  const poll = app.poll!;
  const max = config.multiple ? (config.maxChoices ?? config.options.length + 1) : 1;
  const picked = choices.length + (other.trim() ? 1 : 0);
  const total = Math.max(1, poll.voterCount);

  const toggle = (i: number) => {
    if (!config.multiple) {
      setChoices([i]);
      setOther("");
      return;
    }
    setChoices((list) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i]));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {[
          config.anonymous ? t("anonymousVote") : t("namedVote"),
          config.multiple ? (config.maxChoices ? t("multipleMax", { max: config.maxChoices }) : t("multipleAny")) : t("single"),
          t(`results.${config.showResults}`),
        ].join(" · ")}
      </p>
      <div className="flex flex-col gap-1.5">
        {config.options.map((option, i) => {
          const count = poll.counts?.[i] ?? 0;
          const voters = poll.voters?.[i] ?? [];
          const row = (
            <div className="relative overflow-hidden rounded-md border border-border">
              {poll.counts ? (
                <div className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${(count / total) * 100}%` }} />
              ) : null}
              <label className="relative flex items-center gap-2 px-3 py-2 text-sm">
                {app.viewer.canRespond ? (
                  <Checkbox
                    checked={choices.includes(i)}
                    onCheckedChange={() => toggle(i)}
                    disabled={!choices.includes(i) && config.multiple && picked >= max}
                  />
                ) : null}
                <span className="flex-1">{option}</span>
                {poll.counts ? <span className="text-xs text-muted-foreground">{count}</span> : null}
              </label>
            </div>
          );
          return voters.length > 0 ? (
            <Tooltip key={i}>
              <TooltipTrigger asChild>{row}</TooltipTrigger>
              <TooltipContent>
                {voters.map((id) => displayName(app.people.find((p) => p._id === id), locale)).join(locale === "zh" ? "、" : ", ")}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div key={i}>{row}</div>
          );
        })}
        {config.allowOther && app.viewer.canRespond ? (
          <Input
            value={other}
            maxLength={LIMITS.pollOther}
            placeholder={t("otherPlaceholder")}
            onChange={(e) => {
              setOther(e.target.value);
              if (!config.multiple && e.target.value) setChoices([]);
            }}
          />
        ) : null}
      </div>
      {poll.counts === null ? <p className="text-xs text-muted-foreground">{t("resultsHidden")}</p> : null}
      {poll.others && poll.others.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("otherAnswers")}</span>
          {poll.others.map((o, i) => (
            <span key={i} className="text-sm">
              {o.userId ? `${displayName(app.people.find((p) => p._id === o.userId), locale)}：` : ""}
              {o.text}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t("voters", { count: poll.voterCount })}</span>
        {app.viewer.canRespond ? (
          <div className="flex gap-2">
            {app.mine ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  withdraw({ appId: app._id })
                    .then(() => {
                      setChoices([]);
                      setOther("");
                    })
                    .catch(showError)
                }
              >
                {t("withdrawVote")}
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={picked === 0 || picked > max}
              onClick={() =>
                respond({ appId: app._id, data: { choices, other: other.trim() || undefined } }).catch(showError)
              }
            >
              {app.mine ? t("changeVote") : t("vote")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ManageActions({ app }: { app: AppView }) {
  const t = useTranslations("apps");
  const viewer = useViewer();
  const review = useMutation(api.apps.review);
  const cancel = useMutation(api.apps.cancelProposal);
  const close = useMutation(api.apps.close);
  const reopen = useMutation(api.apps.reopen);
  const update = useMutation(api.apps.update);
  const showError = useErrorToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(app.title);
  const [description, setDescription] = useState(app.description ?? "");

  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
      {app.viewer.canReview ? (
        <>
          <Button size="sm" onClick={() => review({ appId: app._id, approve: true }).catch(showError)}>
            {t("approve")}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setRejecting(true)}>
            {t("reject")}
          </Button>
        </>
      ) : null}
      {app.status === "proposed" && app.createdBy === viewer._id ? (
        <Button size="sm" variant="ghost" onClick={() => cancel({ appId: app._id }).catch(showError)}>
          {t("cancelProposal")}
        </Button>
      ) : null}
      {app.viewer.canManage && (app.status === "active" || app.status === "proposed") ? (
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          {t("edit")}
        </Button>
      ) : null}
      {app.viewer.canManage && app.status === "active" && app.kind !== "meeting" ? (
        <Button size="sm" variant="secondary" onClick={() => close({ appId: app._id }).catch(showError)}>
          {t("close")}
        </Button>
      ) : null}
      {app.viewer.canManage && app.status === "closed" ? (
        <Button size="sm" variant="secondary" onClick={() => reopen({ appId: app._id }).catch(showError)}>
          {t("reopen")}
        </Button>
      ) : null}

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
          </DialogHeader>
          <Textarea rows={3} value={reason} placeholder={t("rejectReason")} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim()}
              onClick={() =>
                review({ appId: app._id, approve: false, reason })
                  .then(() => setRejecting(false))
                  .catch(showError)
              }
            >
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit")}</DialogTitle>
          </DialogHeader>
          <Input value={title} maxLength={LIMITS.appTitle} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={3} value={description} maxLength={LIMITS.appDescription} onChange={(e) => setDescription(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={!title.trim()}
              onClick={() =>
                update({ appId: app._id, title, description: description.trim() || undefined, deadline: app.deadline })
                  .then(() => setEditing(false))
                  .catch(showError)
              }
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** "已结束" list from the chat menu. */
export function EndedAppsDialog({
  channelId,
  open,
  onOpenChange,
  onOpenApp,
}: {
  channelId: Id<"channels">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenApp: (appId: Id<"chatApps">) => void;
}) {
  const t = useTranslations("apps");
  const format = useFormatter();
  const apps = useQuery(api.apps.list, open ? { channelId } : "skip");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("endedTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          {apps?.ended.length === 0 ? <p className="text-sm text-muted-foreground">{t("noEnded")}</p> : null}
          {(apps?.ended ?? []).map((app) => {
            const Icon = APP_ICONS[app.kind];
            return (
              <button
                key={app._id}
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenApp(app._id);
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Icon className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{app.title}</span>
                {app.closedAt ? (
                  <span className="text-xs text-muted-foreground">{format.dateTime(app.closedAt, { month: "short", day: "numeric" })}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
