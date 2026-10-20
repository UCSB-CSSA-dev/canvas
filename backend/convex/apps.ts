import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  activeLeadIds,
  channelAccess,
  channelAudience,
  groupDepartmentIds,
  presidiumUserIds,
  requireChannelAccess,
  retentionDays,
  userParticipates,
  type ChannelAccess,
} from "./lib/channels";
import { LIMITS } from "./lib/constants";
import { appError } from "./lib/errors";
import { postSystemMessage } from "./lib/messages";
import { notify, notifyMany } from "./lib/notify";
import { buildViewerContext, requireApproved, type ViewerContext } from "./lib/permissions";
import { getUserSummaries } from "./lib/users";

const DAY_MS = 24 * 60 * 60 * 1000;
/** 集会 slots are indexed weekday * SLOTS_PER_DAY + minuteOfDay / slotMinutes, weekday 0 = Sunday. */
const SLOTS_PER_DAY = (24 * 60) / LIMITS.meetingSlotMinutes;

const showResults = v.union(v.literal("live"), v.literal("after_vote"), v.literal("after_close"));
const signupConfig = v.object({ example: v.optional(v.string()), cap: v.optional(v.number()) });
const pollConfig = v.object({
  options: v.array(v.string()),
  multiple: v.boolean(),
  maxChoices: v.optional(v.number()),
  allowOther: v.boolean(),
  anonymous: v.boolean(),
  showResults,
});
const meetingConfig = v.object({
  days: v.array(v.number()),
  startMinutes: v.number(),
  endMinutes: v.number(),
  durationMinutes: v.number(),
});
const appSpec = v.union(
  v.object({ kind: v.literal("signup"), config: signupConfig }),
  v.object({ kind: v.literal("poll"), config: pollConfig }),
  v.object({ kind: v.literal("meeting"), config: meetingConfig }),
);
const responseData = v.union(
  v.object({ text: v.string() }),
  v.object({ choices: v.array(v.number()), other: v.optional(v.string()) }),
  v.object({ slots: v.array(v.number()) }),
);

export type SignupConfig = Infer<typeof signupConfig>;
export type PollConfig = Infer<typeof pollConfig>;
export type MeetingConfig = Infer<typeof meetingConfig>;
type AppSpec = Infer<typeof appSpec>;

function cleanText(value: string | undefined, max: number, field: string, required = false) {
  const trimmed = (value ?? "").trim();
  if (trimmed.length > max || (required && !trimmed)) throw appError("INVALID", field);
  return trimmed || undefined;
}

function isInt(n: number) {
  return Number.isInteger(n);
}

function cleanSpec(spec: AppSpec): AppSpec {
  switch (spec.kind) {
    case "signup": {
      const cap = spec.config.cap;
      if (cap !== undefined && (!isInt(cap) || cap < 1 || cap > LIMITS.signupCap)) throw appError("INVALID", "cap");
      return {
        kind: "signup",
        config: { example: cleanText(spec.config.example, LIMITS.signupExample, "example"), cap },
      };
    }
    case "poll": {
      const options = spec.config.options.map((o) => cleanText(o, LIMITS.pollOption, "option", true)!);
      if (options.length < LIMITS.pollOptionsMin || options.length > LIMITS.pollOptionsMax) {
        throw appError("INVALID", "options");
      }
      const max = spec.config.maxChoices;
      if (max !== undefined && (!spec.config.multiple || !isInt(max) || max < 1 || max > options.length)) {
        throw appError("INVALID", "maxChoices");
      }
      return { kind: "poll", config: { ...spec.config, options } };
    }
    case "meeting": {
      const { startMinutes, endMinutes, durationMinutes } = spec.config;
      const days = [...new Set(spec.config.days)].sort();
      const step = LIMITS.meetingSlotMinutes;
      const aligned = [startMinutes, endMinutes, durationMinutes].every((m) => isInt(m) && m % step === 0);
      if (
        days.length === 0 ||
        days.some((d) => !isInt(d) || d < 0 || d > 6) ||
        !aligned ||
        startMinutes < 0 ||
        endMinutes > 24 * 60 ||
        startMinutes >= endMinutes ||
        durationMinutes < step ||
        durationMinutes > endMinutes - startMinutes
      ) {
        throw appError("INVALID", "meeting");
      }
      return { kind: "meeting", config: { days, startMinutes, endMinutes, durationMinutes } };
    }
  }
}

function meetingSlots(config: MeetingConfig) {
  const slots = new Set<number>();
  for (const day of config.days) {
    for (let m = config.startMinutes; m < config.endMinutes; m += LIMITS.meetingSlotMinutes) {
      slots.add(day * SLOTS_PER_DAY + m / LIMITS.meetingSlotMinutes);
    }
  }
  return slots;
}

/** Start slots where the whole meeting fits in the day's range. */
function meetingStarts(config: MeetingConfig) {
  const starts: number[] = [];
  for (const day of config.days) {
    for (let m = config.startMinutes; m + config.durationMinutes <= config.endMinutes; m += LIMITS.meetingSlotMinutes) {
      starts.push(day * SLOTS_PER_DAY + m / LIMITS.meetingSlotMinutes);
    }
  }
  return starts;
}

/** Monday-first order, so "earlier" ties match how the grid reads. */
function weekOrder(slot: number) {
  const day = Math.floor(slot / SLOTS_PER_DAY);
  return ((day + 6) % 7) * SLOTS_PER_DAY + (slot % SLOTS_PER_DAY);
}

export function bestTimes(config: MeetingConfig, responses: { userId: Id<"users">; slots: number[] }[]) {
  const length = config.durationMinutes / LIMITS.meetingSlotMinutes;
  const sets = responses.map((r) => ({ userId: r.userId, slots: new Set(r.slots) }));
  const scored = meetingStarts(config).map((start) => {
    const userIds = sets
      .filter((r) => Array.from({ length }, (_, k) => start + k).every((s) => r.slots.has(s)))
      .map((r) => r.userId);
    return { start, userIds };
  });
  return scored
    .filter((s) => s.userIds.length > 0)
    .sort((a, b) => b.userIds.length - a.userIds.length || weekOrder(a.start) - weekOrder(b.start))
    .slice(0, LIMITS.bestTimes);
}

// ---------- Access ----------

/** Starter or an approver of the chat. */
function canManageApp(viewer: ViewerContext, access: ChannelAccess, app: Doc<"chatApps">) {
  return access.via === "member" && (app.createdBy === viewer.user._id || access.canApproveApps);
}

async function requireApp(ctx: QueryCtx, viewer: ViewerContext, appId: Id<"chatApps">) {
  const app = await ctx.db.get("chatApps", appId);
  if (!app) throw appError("NOT_FOUND");
  const { channel, access } = await requireChannelAccess(ctx, viewer, app.channelId);
  const visible =
    app.status === "active" ||
    app.status === "closed" ||
    (app.status === "proposed" && (app.createdBy === viewer.user._id || access.canApproveApps));
  if (!visible) throw appError("NOT_FOUND");
  return { app, channel, access };
}

/** People who can approve apps in this chat. */
async function approverIds(ctx: QueryCtx, channel: Doc<"channels">) {
  const candidates = new Set(await presidiumUserIds(ctx));
  const departmentIds =
    channel.type === "group"
      ? await groupDepartmentIds(ctx, channel._id)
      : channel.departmentId
        ? [channel.departmentId]
        : [];
  for (const id of departmentIds) for (const leadId of await activeLeadIds(ctx, id)) candidates.add(leadId);
  const ids: Id<"users">[] = [];
  for (const id of candidates) {
    const user = await ctx.db.get("users", id);
    if (!user || user.status !== "approved") continue;
    const access = await channelAccess(ctx, await buildViewerContext(ctx, user), channel);
    if (access.via === "member" && access.canApproveApps) ids.push(id);
  }
  return ids;
}

async function runningCount(ctx: QueryCtx, channelId: Id<"channels">) {
  const running = await ctx.db
    .query("chatApps")
    .withIndex("by_channel_status", (q) => q.eq("channelId", channelId).eq("status", "active"))
    .collect();
  return running.length;
}

function appLink(app: Doc<"chatApps">) {
  return `/chat/?c=${app.channelId}&app=${app._id}`;
}

/** Starts an app: system message plus the deadline jobs. */
async function activate(ctx: MutationCtx, app: Doc<"chatApps">, actorId: Id<"users">) {
  if ((await runningCount(ctx, app.channelId)) >= LIMITS.appsPerChannel) throw appError("TOO_MANY_APPS");
  await ctx.db.patch("chatApps", app._id, { status: "active", closedAt: undefined });
  await postSystemMessage(ctx, {
    channelId: app.channelId,
    actorId,
    event: "app_started",
    params: { actorId: app.createdBy, kind: app.kind, title: app.title, appId: app._id },
  });
  await scheduleDeadline(ctx, app._id, app.deadline);
}

async function scheduleDeadline(ctx: MutationCtx, appId: Id<"chatApps">, deadline: number | undefined) {
  if (deadline === undefined) return;
  const now = Date.now();
  if (deadline > now) await ctx.scheduler.runAt(deadline, internal.apps.autoClose, { appId, deadline });
  const soon = deadline - LIMITS.appDueSoonMs;
  if (soon > now) await ctx.scheduler.runAt(soon, internal.apps.dueSoon, { appId, deadline });
}

function cleanDeadline(deadline: number | undefined) {
  if (deadline === undefined) return undefined;
  if (deadline <= Date.now() || deadline > Date.now() + 365 * DAY_MS) throw appError("INVALID", "deadline");
  return deadline;
}

// ---------- Queries ----------

export type AppSummary = {
  _id: Id<"chatApps">;
  kind: Doc<"chatApps">["kind"];
  status: Doc<"chatApps">["status"];
  title: string;
  deadline?: number;
  closedAt?: number;
  createdBy: Id<"users">;
  responseCount: number;
};

export const list = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const { access } = await requireChannelAccess(ctx, viewer, args.channelId);
    const summarize = async (status: Doc<"chatApps">["status"]) => {
      const apps = await ctx.db
        .query("chatApps")
        .withIndex("by_channel_status", (q) => q.eq("channelId", args.channelId).eq("status", status))
        .order("desc")
        .take(50);
      return Promise.all(
        apps.map(async (app): Promise<AppSummary> => ({
          _id: app._id,
          kind: app.kind,
          status: app.status,
          title: app.title,
          deadline: app.deadline,
          closedAt: app.closedAt,
          createdBy: app.createdBy,
          responseCount: (
            await ctx.db
              .query("chatAppResponses")
              .withIndex("by_app", (q) => q.eq("appId", app._id))
              .collect()
          ).length,
        })),
      );
    };
    const proposed = (await summarize("proposed")).filter(
      (a) => a.createdBy === viewer.user._id || access.canApproveApps,
    );
    return {
      running: await summarize("active"),
      proposed,
      ended: await summarize("closed"),
      canCreate: access.canApproveApps,
      canPropose: access.canProposeApps && !access.canApproveApps,
    };
  },
});

export type SignupView = { entries: { userId: Id<"users">; text: string; at: number }[]; full: boolean };
export type PollView = {
  /** Null while results are hidden from the viewer. */
  counts: number[] | null;
  /** Named votes only. */
  voters: Id<"users">[][] | null;
  others: { text: string; userId?: Id<"users"> }[] | null;
  voterCount: number;
};
export type MeetingView = {
  slots: { slot: number; userIds: Id<"users">[] }[];
  best: { start: number; userIds: Id<"users">[] }[];
  respondents: Id<"users">[];
};

export const get = query({
  args: { appId: v.id("chatApps") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const { app, access } = await requireApp(ctx, viewer, args.appId);
    const responses = await ctx.db
      .query("chatAppResponses")
      .withIndex("by_app", (q) => q.eq("appId", app._id))
      .collect();
    const mine = responses.find((r) => r.userId === viewer.user._id);
    const canManage = canManageApp(viewer, access, app);
    const people = new Set<Id<"users">>([app.createdBy]);
    if (app.approvedBy) people.add(app.approvedBy);

    let signup: SignupView | undefined;
    let poll: PollView | undefined;
    let meeting: MeetingView | undefined;

    if (app.kind === "signup") {
      const config = app.config as SignupConfig;
      const entries = responses
        .sort((a, b) => a._creationTime - b._creationTime)
        .map((r) => ({ userId: r.userId, text: String(r.data?.text ?? ""), at: r._creationTime }));
      for (const e of entries) people.add(e.userId);
      signup = { entries, full: config.cap !== undefined && entries.length >= config.cap };
    } else if (app.kind === "poll") {
      const config = app.config as PollConfig;
      const visible =
        canManage ||
        config.showResults === "live" ||
        app.status === "closed" ||
        (config.showResults === "after_vote" && mine !== undefined);
      if (visible) {
        const counts = config.options.map(() => 0);
        const voters: Id<"users">[][] = config.options.map(() => []);
        const others: PollView["others"] = [];
        for (const r of responses) {
          for (const choice of (r.data?.choices ?? []) as number[]) {
            counts[choice] = (counts[choice] ?? 0) + 1;
            voters[choice]?.push(r.userId);
          }
          if (r.data?.other) others.push(config.anonymous ? { text: r.data.other } : { text: r.data.other, userId: r.userId });
        }
        if (!config.anonymous) for (const r of responses) people.add(r.userId);
        poll = {
          counts,
          voters: config.anonymous ? null : voters,
          others,
          voterCount: responses.length,
        };
      } else {
        poll = { counts: null, voters: null, others: null, voterCount: responses.length };
      }
    } else {
      const config = app.config as MeetingConfig;
      const bySlot = new Map<number, Id<"users">[]>();
      const parsed = responses.map((r) => ({ userId: r.userId, slots: (r.data?.slots ?? []) as number[] }));
      for (const r of parsed) {
        people.add(r.userId);
        for (const slot of r.slots) bySlot.set(slot, [...(bySlot.get(slot) ?? []), r.userId]);
      }
      meeting = {
        slots: [...bySlot.entries()].map(([slot, userIds]) => ({ slot, userIds })),
        best: bestTimes(config, parsed),
        respondents: parsed.map((r) => r.userId),
      };
    }

    const summaries = await getUserSummaries(ctx, [...people]);
    return {
      _id: app._id,
      _creationTime: app._creationTime,
      channelId: app.channelId,
      kind: app.kind,
      status: app.status,
      title: app.title,
      description: app.description,
      config: app.config as SignupConfig | PollConfig | MeetingConfig,
      createdBy: app.createdBy,
      approvedBy: app.approvedBy,
      rejectReason: app.rejectReason,
      deadline: app.deadline,
      closedAt: app.closedAt,
      confirmedSlot: app.confirmedSlot,
      mine: mine ? (mine.data as Infer<typeof responseData>) : null,
      responseCount: responses.length,
      signup,
      poll,
      meeting,
      people: [...summaries.values()],
      viewer: {
        canRespond: app.status === "active" && access.via === "member" && access.canInteract,
        canManage: canManage && access.canInteract,
        canReview: app.status === "proposed" && access.canApproveApps && access.canInteract,
        canEditStructure: responses.length === 0 && app.status !== "closed",
      },
    };
  },
});

/** The viewer's most recent 集会 availability, to pre-fill a new grid. */
export const myLastAvailability = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireApproved(ctx);
    const rows = await ctx.db
      .query("chatAppResponses")
      .withIndex("by_user", (q) => q.eq("userId", viewer.user._id))
      .order("desc")
      .take(50);
    const latest = rows.find((r) => Array.isArray(r.data?.slots));
    return latest ? (latest.data.slots as number[]) : null;
  },
});

// ---------- Mutations ----------

export const create = mutation({
  args: {
    channelId: v.id("channels"),
    title: v.string(),
    description: v.optional(v.string()),
    deadline: v.optional(v.number()),
    spec: appSpec,
  },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const { channel, access } = await requireChannelAccess(ctx, viewer, args.channelId);
    if (access.via !== "member" || channel.type === "dm") throw appError("FORBIDDEN");
    if (access.readOnly) throw appError("READ_ONLY");
    if (!access.canApproveApps && !access.canProposeApps) throw appError("FORBIDDEN");
    const spec = cleanSpec(args.spec);
    const title = cleanText(args.title, LIMITS.appTitle, "title", true)!;
    const description = cleanText(args.description, LIMITS.appDescription, "description");
    const deadline = cleanDeadline(args.deadline);

    const direct = access.canApproveApps;
    if (direct && (await runningCount(ctx, channel._id)) >= LIMITS.appsPerChannel) throw appError("TOO_MANY_APPS");
    const appId = await ctx.db.insert("chatApps", {
      channelId: channel._id,
      kind: spec.kind,
      status: "proposed",
      title,
      description,
      config: spec.config,
      createdBy: viewer.user._id,
      deadline,
    });
    const app = (await ctx.db.get("chatApps", appId))!;
    if (direct) {
      await activate(ctx, app, viewer.user._id);
    } else {
      await notifyMany(
        ctx,
        (await approverIds(ctx, channel)).filter((id) => id !== viewer.user._id),
        { type: "app_proposed", params: { actorId: viewer.user._id, kind: spec.kind, title }, link: appLink(app) },
      );
    }
    return appId;
  },
});

export const review = mutation({
  args: { appId: v.id("chatApps"), approve: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const { app, channel, access } = await requireApp(ctx, viewer, args.appId);
    if (app.status !== "proposed") throw appError("ALREADY_REVIEWED");
    if (!access.canApproveApps || !access.canInteract) throw appError("FORBIDDEN");
    if (!(await userParticipates(ctx, app.createdBy, channel))) {
      await ctx.db.patch("chatApps", app._id, { status: "cancelled", closedAt: Date.now() });
      return { cancelled: true };
    }
    if (args.approve) {
      if (app.deadline !== undefined && app.deadline <= Date.now()) throw appError("INVALID", "deadline");
      await ctx.db.patch("chatApps", app._id, { approvedBy: viewer.user._id });
      await activate(ctx, app, viewer.user._id);
      await notify(ctx, app.createdBy, {
        type: "app_approved",
        params: { reviewerId: viewer.user._id, kind: app.kind, title: app.title },
        link: appLink(app),
      });
      return { cancelled: false };
    }
    const reason = cleanText(args.reason, LIMITS.reviewNote, "reason", true)!;
    await ctx.db.patch("chatApps", app._id, { status: "rejected", rejectReason: reason, closedAt: Date.now() });
    await notify(ctx, app.createdBy, {
      type: "app_rejected",
      params: { reviewerId: viewer.user._id, kind: app.kind, title: app.title, note: reason },
      link: appLink(app),
    });
    return { cancelled: false };
  },
});

export const cancelProposal = mutation({
  args: { appId: v.id("chatApps") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const { app } = await requireApp(ctx, viewer, args.appId);
    if (app.createdBy !== viewer.user._id) throw appError("FORBIDDEN");
    if (app.status !== "proposed") throw appError("ALREADY_REVIEWED");
    await ctx.db.patch("chatApps", app._id, { status: "cancelled", closedAt: Date.now() });
  },
});

export const respond = mutation({
  args: { appId: v.id("chatApps"), data: responseData },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const { app, access } = await requireApp(ctx, viewer, args.appId);
    if (app.status !== "active") throw appError("INVALID", "status");
    if (access.via !== "member" || !access.canInteract) throw appError("FORBIDDEN");
    const existing = await ctx.db
      .query("chatAppResponses")
      .withIndex("by_app_user", (q) => q.eq("appId", app._id).eq("userId", viewer.user._id))
      .unique();

    let data: Infer<typeof responseData>;
    if (app.kind === "signup") {
      if (!("text" in args.data)) throw appError("INVALID", "data");
      const config = app.config as SignupConfig;
      if (!existing && config.cap !== undefined) {
        const count = (
          await ctx.db
            .query("chatAppResponses")
            .withIndex("by_app", (q) => q.eq("appId", app._id))
            .collect()
        ).length;
        if (count >= config.cap) throw appError("SIGNUP_FULL");
      }
      data = { text: cleanText(args.data.text, LIMITS.signupEntry, "text", true)! };
    } else if (app.kind === "poll") {
      if (!("choices" in args.data)) throw appError("INVALID", "data");
      const config = app.config as PollConfig;
      const choices = [...new Set(args.data.choices)];
      if (choices.some((c) => !isInt(c) || c < 0 || c >= config.options.length)) throw appError("INVALID", "choices");
      const other = config.allowOther ? cleanText(args.data.other, LIMITS.pollOther, "other") : undefined;
      const picked = choices.length + (other ? 1 : 0);
      const max = config.multiple ? (config.maxChoices ?? config.options.length + 1) : 1;
      if (picked === 0 || picked > max) throw appError("INVALID", "choices");
      data = other ? { choices, other } : { choices };
    } else {
      if (!("slots" in args.data)) throw appError("INVALID", "data");
      const allowed = meetingSlots(app.config as MeetingConfig);
      const slots = [...new Set(args.data.slots)];
      if (slots.some((s) => !allowed.has(s))) throw appError("INVALID", "slots");
      data = { slots: slots.sort((a, b) => a - b) };
    }

    if (existing) await ctx.db.patch("chatAppResponses", existing._id, { data });
    else await ctx.db.insert("chatAppResponses", { appId: app._id, userId: viewer.user._id, data });
  },
});

export const withdraw = mutation({
  args: { appId: v.id("chatApps") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const { app, access } = await requireApp(ctx, viewer, args.appId);
    if (app.status !== "active") throw appError("INVALID", "status");
    if (access.via !== "member" || !access.canInteract) throw appError("FORBIDDEN");
    const existing = await ctx.db
      .query("chatAppResponses")
      .withIndex("by_app_user", (q) => q.eq("appId", app._id).eq("userId", viewer.user._id))
      .unique();
    if (existing) await ctx.db.delete("chatAppResponses", existing._id);
  },
});

/** Title, description, and deadline any time; the structure only until the first response. */
export const update = mutation({
  args: {
    appId: v.id("chatApps"),
    title: v.string(),
    description: v.optional(v.string()),
    deadline: v.optional(v.number()),
    spec: v.optional(appSpec),
  },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const { app, access } = await requireApp(ctx, viewer, args.appId);
    if (!canManageApp(viewer, access, app) || !access.canInteract) throw appError("FORBIDDEN");
    if (app.status !== "active" && app.status !== "proposed") throw appError("INVALID", "status");
    const patch: Partial<Doc<"chatApps">> = {
      title: cleanText(args.title, LIMITS.appTitle, "title", true)!,
      description: cleanText(args.description, LIMITS.appDescription, "description"),
    };
    if (args.deadline !== app.deadline) {
      patch.deadline = cleanDeadline(args.deadline);
      if (app.status === "active") await scheduleDeadline(ctx, app._id, patch.deadline);
    }
    if (args.spec) {
      if (args.spec.kind !== app.kind) throw appError("INVALID", "kind");
      const responses = await ctx.db
        .query("chatAppResponses")
        .withIndex("by_app", (q) => q.eq("appId", app._id))
        .first();
      if (responses) throw appError("INVALID", "locked");
      const spec = cleanSpec(args.spec);
      if (spec.kind === "poll" && app.status === "active") {
        const before = app.config as PollConfig;
        if (spec.config.anonymous !== before.anonymous || spec.config.showResults !== before.showResults) {
          throw appError("INVALID", "locked");
        }
      }
      patch.config = spec.config;
    }
    await ctx.db.patch("chatApps", app._id, patch);
  },
});

async function closeApp(ctx: MutationCtx, app: Doc<"chatApps">, actorId: Id<"users">, confirmedSlot?: number) {
  await ctx.db.patch("chatApps", app._id, { status: "closed", closedAt: Date.now(), confirmedSlot });
  if (confirmedSlot !== undefined) {
    const config = app.config as MeetingConfig;
    await postSystemMessage(ctx, {
      channelId: app.channelId,
      actorId,
      event: "meeting_confirmed",
      params: { actorId, title: app.title, slot: confirmedSlot, durationMinutes: config.durationMinutes },
    });
  }
}

export const close = mutation({
  args: { appId: v.id("chatApps"), confirmedSlot: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const { app, access } = await requireApp(ctx, viewer, args.appId);
    if (!canManageApp(viewer, access, app) || !access.canInteract) throw appError("FORBIDDEN");
    if (app.status !== "active") throw appError("INVALID", "status");
    if (args.confirmedSlot !== undefined) {
      if (app.kind !== "meeting" || !meetingStarts(app.config as MeetingConfig).includes(args.confirmedSlot)) {
        throw appError("INVALID", "slot");
      }
    }
    await closeApp(ctx, app, viewer.user._id, args.confirmedSlot);
  },
});

export const reopen = mutation({
  args: { appId: v.id("chatApps") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const { app, access } = await requireApp(ctx, viewer, args.appId);
    if (!canManageApp(viewer, access, app) || !access.canInteract) throw appError("FORBIDDEN");
    if (app.status !== "closed") throw appError("INVALID", "status");
    if ((await runningCount(ctx, app.channelId)) >= LIMITS.appsPerChannel) throw appError("TOO_MANY_APPS");
    const deadline = app.deadline !== undefined && app.deadline <= Date.now() ? undefined : app.deadline;
    await ctx.db.patch("chatApps", app._id, {
      status: "active",
      closedAt: undefined,
      confirmedSlot: undefined,
      deadline,
    });
  },
});

// ---------- Scheduled ----------

export const autoClose = internalMutation({
  args: { appId: v.id("chatApps"), deadline: v.number() },
  handler: async (ctx, args) => {
    const app = await ctx.db.get("chatApps", args.appId);
    if (!app || app.status !== "active" || app.deadline !== args.deadline) return;
    await closeApp(ctx, app, app.createdBy);
  },
});

export const dueSoon = internalMutation({
  args: { appId: v.id("chatApps"), deadline: v.number() },
  handler: async (ctx, args) => {
    const app = await ctx.db.get("chatApps", args.appId);
    if (!app || app.status !== "active" || app.deadline !== args.deadline) return;
    const channel = await ctx.db.get("channels", app.channelId);
    if (!channel) return;
    const responded = new Set(
      (
        await ctx.db
          .query("chatAppResponses")
          .withIndex("by_app", (q) => q.eq("appId", app._id))
          .collect()
      ).map((r) => r.userId),
    );
    const audience = (await channelAudience(ctx, channel)).filter((id) => !responded.has(id));
    await notifyMany(ctx, audience, {
      type: "app_due_soon",
      params: { kind: app.kind, title: app.title, deadline: app.deadline },
      link: appLink(app),
    });
  },
});

/** Hourly: finished apps are deleted once the chat's retention has passed since they ended. */
export const purge = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let budget = LIMITS.purgeBatch;
    for (const status of ["closed", "rejected", "cancelled"] as const) {
      const apps = await ctx.db
        .query("chatApps")
        .filter((q) => q.eq(q.field("status"), status))
        .take(LIMITS.purgeBatch);
      for (const app of apps) {
        if (budget <= 0) break;
        const channel = await ctx.db.get("channels", app.channelId);
        const ended = app.closedAt ?? app._creationTime;
        if (channel && ended + retentionDays(channel) * DAY_MS > now) continue;
        await deleteApp(ctx, app._id);
        budget--;
      }
    }
  },
});

async function deleteApp(ctx: MutationCtx, appId: Id<"chatApps">) {
  const responses = await ctx.db
    .query("chatAppResponses")
    .withIndex("by_app", (q) => q.eq("appId", appId))
    .collect();
  for (const r of responses) await ctx.db.delete("chatAppResponses", r._id);
  await ctx.db.delete("chatApps", appId);
}
