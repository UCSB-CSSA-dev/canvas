"use client";

import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, LIMITS } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { AppView } from "./app-panel";
import { clock, slotDay, slotMinutes, slotOf, WEEK_ORDER } from "./slots";

type MeetingConfig = { days: number[]; startMinutes: number; endMinutes: number; durationMinutes: number };

export function MeetingBody({ app }: { app: AppView }) {
  const t = useTranslations("apps");
  const tDays = useTranslations("weekdays");
  const locale = useLocale() as Locale;
  const respond = useMutation(api.apps.respond);
  const withdraw = useMutation(api.apps.withdraw);
  const close = useMutation(api.apps.close);
  const showError = useErrorToast();
  const last = useQuery(api.apps.myLastAvailability, app.viewer.canRespond ? {} : "skip");
  const config = app.config as MeetingConfig;
  const meeting = app.meeting!;
  const mineSaved = app.mine && "slots" in app.mine ? app.mine.slots : null;
  const [mode, setMode] = useState<"mine" | "group">(app.viewer.canRespond && !mineSaved ? "mine" : "group");
  const [draft, setDraft] = useState<Set<number>>(() => new Set(mineSaved ?? []));
  const [dirty, setDirty] = useState(false);
  const painting = useRef<boolean | null>(null);

  const days = WEEK_ORDER.filter((d) => config.days.includes(d));
  const times = useMemo(() => {
    const list: number[] = [];
    for (let m = config.startMinutes; m < config.endMinutes; m += LIMITS.meetingSlotMinutes) list.push(m);
    return list;
  }, [config.startMinutes, config.endMinutes]);
  const allowed = useMemo(() => new Set(days.flatMap((d) => times.map((m) => slotOf(d, m)))), [days, times]);
  const counts = useMemo(() => new Map(meeting.slots.map((s) => [s.slot, s.userIds])), [meeting.slots]);
  const respondents = meeting.respondents.length;
  const name = (id: string) => displayName(app.people.find((p) => p._id === id), locale);
  const separator = locale === "zh" ? "、" : ", ";

  const paint = (slot: number) => {
    if (painting.current === null) return;
    const on = painting.current;
    setDraft((prev) => {
      if (prev.has(slot) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(slot);
      else next.delete(slot);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    try {
      if (draft.size === 0) await withdraw({ appId: app._id });
      else await respond({ appId: app._id, data: { slots: [...draft].sort((a, b) => a - b) } });
      setDirty(false);
      setMode("group");
      toast.success(t("saved"));
    } catch (error) {
      showError(error);
    }
  };

  const label = (slot: number) =>
    `${tDays(String(slotDay(slot)) as "0")} ${clock(slotMinutes(slot))}–${clock(slotMinutes(slot) + config.durationMinutes)}`;

  return (
    <div className="flex flex-col gap-3">
      {app.status === "closed" && app.confirmedSlot !== undefined ? (
        <div className="rounded-md border border-primary/50 bg-primary/10 p-3 text-sm">
          {t("confirmed", { time: label(app.confirmedSlot) })}
        </div>
      ) : null}

      {app.viewer.canRespond ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant={mode === "mine" ? "default" : "outline"} onClick={() => setMode("mine")}>
            {t("myTime")}
          </Button>
          <Button size="sm" variant={mode === "group" ? "default" : "outline"} onClick={() => setMode("group")}>
            {t("groupTime")}
          </Button>
          {mode === "mine" && last && last.some((s) => allowed.has(s)) ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(new Set(last.filter((s) => allowed.has(s))));
                setDirty(true);
              }}
            >
              {t("useLast")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {mode === "mine" ? t("paintHint") : t("heatHint", { count: respondents })}
      </p>

      <div
        className="grid touch-none select-none gap-px overflow-x-auto rounded-md border border-border bg-border text-[11px]"
        style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(2.5rem, 1fr))` }}
        onPointerUp={() => (painting.current = null)}
        onPointerLeave={() => (painting.current = null)}
      >
        <div className="bg-background" />
        {days.map((d) => (
          <div key={d} className="bg-background py-1 text-center font-medium">
            {tDays(String(d) as "0")}
          </div>
        ))}
        {times.map((m) => (
          <Fragment key={m}>
            <div className="bg-background pr-1 text-right text-muted-foreground">{m % 60 === 0 ? clock(m) : ""}</div>
            {days.map((d) => {
              const slot = slotOf(d, m);
              if (mode === "mine") {
                const on = draft.has(slot);
                return (
                  <div
                    key={d}
                    className={cn("h-5 cursor-pointer", on ? "bg-primary" : "bg-background hover:bg-accent")}
                    onPointerDown={(e) => {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                      painting.current = !on;
                      paint(slot);
                    }}
                    onPointerEnter={() => paint(slot)}
                  />
                );
              }
              const people = counts.get(slot) ?? [];
              const share = respondents ? people.length / respondents : 0;
              const busy = meeting.respondents.filter((id) => !people.includes(id));
              const title = [
                `${tDays(String(d) as "0")} ${clock(m)}`,
                people.length ? t("freeList", { names: people.map(name).join(separator) }) : null,
                busy.length ? t("busyList", { names: busy.map(name).join(separator) }) : null,
              ]
                .filter(Boolean)
                .join("\n");
              return (
                <div key={d} className="relative h-5 bg-background" title={title}>
                  {share > 0 ? <div className="absolute inset-0 bg-primary" style={{ opacity: 0.15 + share * 0.85 }} /> : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      {mode === "mine" && app.viewer.canRespond ? (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(new Set());
              setDirty(true);
            }}
          >
            {t("clear")}
          </Button>
          <Button size="sm" disabled={!dirty} onClick={() => void save()}>
            {t("saveTime")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("bestTimes", { minutes: config.durationMinutes })}</span>
        {meeting.best.length === 0 ? <p className="text-xs text-muted-foreground">{t("noBest")}</p> : null}
        {meeting.best.map((b) => (
          <div key={b.start} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div>{label(b.start)}</div>
              <div className="truncate text-xs text-muted-foreground">
                {t("availableCount", { count: b.userIds.length, total: respondents })} · {b.userIds.map(name).join(separator)}
              </div>
            </div>
            {app.viewer.canManage && app.status === "active" ? (
              <Button size="xs" variant="secondary" onClick={() => close({ appId: app._id, confirmedSlot: b.start }).catch(showError)}>
                {t("confirmTime")}
              </Button>
            ) : null}
          </div>
        ))}
        {app.viewer.canManage && app.status === "active" ? (
          <Button size="sm" variant="ghost" className="self-start" onClick={() => close({ appId: app._id }).catch(showError)}>
            {t("closeWithoutTime")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}