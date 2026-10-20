"use client";

import { useMutation } from "convex/react";
import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useChat } from "@/components/chat/chat-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { api, LIMITS, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { APP_ICONS } from "./app-bar";
import { clock, WEEK_ORDER } from "./slots";

type Kind = "signup" | "poll" | "meeting";
type ShowResults = "live" | "after_vote" | "after_close";

const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => i * LIMITS.meetingSlotMinutes);

export function CreateAppDialog({
  canCreate,
  onCreated,
  children,
}: {
  canCreate: boolean;
  onCreated: (appId: Id<"chatApps">) => void;
  children: ReactNode;
}) {
  const t = useTranslations("apps");
  const tDays = useTranslations("weekdays");
  const { channel } = useChat();
  const create = useMutation(api.apps.create);
  const showError = useErrorToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("signup");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  // 接龙
  const [example, setExample] = useState("");
  const [cap, setCap] = useState("");
  // 投票
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [maxChoices, setMaxChoices] = useState("");
  const [allowOther, setAllowOther] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [showResults, setShowResults] = useState<ShowResults>("live");
  // 集会
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState(18 * 60);
  const [end, setEnd] = useState(22 * 60);
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);

  const spec = () => {
    switch (kind) {
      case "signup":
        return {
          kind,
          config: { example: example.trim() || undefined, cap: cap ? Number(cap) : undefined },
        } as const;
      case "poll":
        return {
          kind,
          config: {
            options: options.map((o) => o.trim()).filter(Boolean),
            multiple,
            maxChoices: multiple && maxChoices ? Number(maxChoices) : undefined,
            allowOther,
            anonymous,
            showResults,
          },
        } as const;
      case "meeting":
        return { kind, config: { days, startMinutes: start, endMinutes: end, durationMinutes: duration } } as const;
    }
  };

  const valid =
    title.trim().length > 0 &&
    (kind !== "poll" || options.filter((o) => o.trim()).length >= LIMITS.pollOptionsMin) &&
    (kind !== "meeting" || (days.length > 0 && start < end && duration <= end - start));

  const submit = async () => {
    setBusy(true);
    try {
      const appId = await create({
        channelId: channel._id,
        title,
        description: description.trim() || undefined,
        deadline: deadline ? new Date(deadline).getTime() : undefined,
        spec: spec(),
      });
      toast.success(canCreate ? t("started") : t("proposedToast"));
      setOpen(false);
      setTitle("");
      setDescription("");
      onCreated(appId);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{canCreate ? t("createTitle") : t("proposeTitle")}</DialogTitle>
          <DialogDescription>{canCreate ? t("createHint") : t("proposeHint")}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh]">
          <div className="flex flex-col gap-4 pr-3">
            <div className="grid grid-cols-3 gap-2">
              {(["signup", "poll", "meeting"] as const).map((k) => {
                const Icon = APP_ICONS[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border p-2.5 text-sm",
                      kind === k ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
                    )}
                  >
                    <Icon className="size-5" />
                    {t(`kind.${k}`)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{t(`kindHint.${kind}`)}</p>

            <Field label={t("title")} id="app-title">
              <Input id="app-title" value={title} maxLength={LIMITS.appTitle} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label={t("description")} id="app-description" optional>
              <Textarea
                id="app-description"
                rows={2}
                value={description}
                maxLength={LIMITS.appDescription}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label={t("deadline")} id="app-deadline" optional>
              <Input id="app-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>

            {kind === "signup" ? (
              <>
                <Field label={t("example")} id="app-example" optional>
                  <Input
                    id="app-example"
                    value={example}
                    maxLength={LIMITS.signupExample}
                    placeholder={t("examplePlaceholder")}
                    onChange={(e) => setExample(e.target.value)}
                  />
                </Field>
                <Field label={t("cap")} id="app-cap" optional>
                  <Input
                    id="app-cap"
                    type="number"
                    min={1}
                    max={LIMITS.signupCap}
                    value={cap}
                    onChange={(e) => setCap(e.target.value)}
                  />
                </Field>
              </>
            ) : null}

            {kind === "poll" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("options")}</Label>
                  {options.map((option, i) => (
                    <div key={i} className="flex gap-1.5">
                      <Input
                        value={option}
                        maxLength={LIMITS.pollOption}
                        placeholder={t("optionN", { n: i + 1 })}
                        onChange={(e) => setOptions((list) => list.map((o, j) => (j === i ? e.target.value : o)))}
                      />
                      {options.length > LIMITS.pollOptionsMin ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t("removeOption")}
                          onClick={() => setOptions((list) => list.filter((_, j) => j !== i))}
                        >
                          <XIcon />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {options.length < LIMITS.pollOptionsMax ? (
                    <Button size="sm" variant="ghost" className="self-start" onClick={() => setOptions((l) => [...l, ""])}>
                      <PlusIcon />
                      {t("addOption")}
                    </Button>
                  ) : null}
                </div>
                <Toggle checked={multiple} onChange={setMultiple} label={t("multiple")} />
                {multiple ? (
                  <Field label={t("maxChoices")} id="app-max" optional>
                    <Input id="app-max" type="number" min={1} value={maxChoices} onChange={(e) => setMaxChoices(e.target.value)} />
                  </Field>
                ) : null}
                <Toggle checked={allowOther} onChange={setAllowOther} label={t("allowOther")} />
                <Toggle checked={anonymous} onChange={setAnonymous} label={t("anonymous")} />
                {anonymous ? <p className="text-xs text-muted-foreground">{t("anonymousHint")}</p> : null}
                <div className="flex flex-col gap-1.5">
                  <Label>{t("showResults")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["live", "after_vote", "after_close"] as const).map((s) => (
                      <Button key={s} size="sm" variant={showResults === s ? "default" : "outline"} onClick={() => setShowResults(s)}>
                        {t(`results.${s}`)}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("lockedHint")}</p>
                </div>
              </>
            ) : null}

            {kind === "meeting" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("days")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEK_ORDER.map((d) => (
                      <Button
                        key={d}
                        size="sm"
                        variant={days.includes(d) ? "default" : "outline"}
                        onClick={() => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))}
                      >
                        {tDays(String(d) as "0")}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <TimeSelect label={t("from")} value={start} onChange={setStart} />
                  <TimeSelect label={t("to")} value={end} onChange={setEnd} />
                  <TimeSelect
                    label={t("duration")}
                    value={duration}
                    onChange={setDuration}
                    options={[30, 60, 90, 120, 180, 240]}
                    format={(m) => t("minutes", { count: m })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("pacificHint")}</p>
              </>
            ) : null}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button disabled={!valid || busy} onClick={() => void submit()}>
            {canCreate ? t("start") : t("proposeApp")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, optional, children }: { label: string; id: string; optional?: boolean; children: ReactNode }) {
  const t = useTranslations("apps");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="text-muted-foreground">{t("optional")}</span> : null}
      </Label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

function TimeSelect({
  label,
  value,
  onChange,
  options = TIME_OPTIONS,
  format = clock,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  options?: number[];
  format?: (minutes: number) => string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        {options.map((m) => (
          <option key={m} value={m} className="bg-popover">
            {format(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
