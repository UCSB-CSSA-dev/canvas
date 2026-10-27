import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { LIMITS } from "./constants";
import { eventEnd, taskLink } from "./tasks";
import { endOfPacificDay, startOfPacificDay } from "./time";

export type DigestItem = {
  title: string;
  kind: "task" | "event";
  /** The task's chat: 全体, a department, or a group name. */
  chatZh: string;
  chatEn: string;
  dueAt?: number;
  startAt?: number;
  endAt?: number;
  location?: string;
  overdue?: boolean;
  /** In-app path, made absolute with SITE_URL when rendering. */
  link: string;
};

export type Digest = { today: DigestItem[]; events: DigestItem[]; todos: DigestItem[] };

export function isEmptyDigest(digest: Digest) {
  return digest.today.length + digest.events.length + digest.todos.length === 0;
}

async function chatNames(ctx: QueryCtx, channelId: Id<"channels">, cache: Map<string, [string, string]>) {
  const cached = cache.get(channelId);
  if (cached) return cached;
  const channel = await ctx.db.get("channels", channelId);
  let names: [string, string] = ["", ""];
  if (channel?.type === "org") names = ["全体", "General"];
  else if (channel?.type === "group") names = [channel.name ?? "", channel.name ?? ""];
  else if (channel?.departmentId) {
    const department = await ctx.db.get("departments", channel.departmentId);
    if (department) names = [department.nameZh, department.nameEn];
  }
  cache.set(channelId, names);
  return names;
}

/**
 * The viewer's open tasks and events for the morning email: today (overdue, due today, events today),
 * events in the next 7 days, and every other to-do.
 */
export async function buildDigest(ctx: QueryCtx, userId: Id<"users">, now: number): Promise<Digest> {
  const todayEnd = endOfPacificDay(now);
  const weekEnd = startOfPacificDay(todayEnd + LIMITS.digestEventDays * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
  const rows = await ctx.db
    .query("assignmentSubmissions")
    .withIndex("by_assignee", (q) => q.eq("assigneeId", userId))
    .collect();
  const cache = new Map<string, [string, string]>();
  const digest: Digest = { today: [], events: [], todos: [] };

  for (const row of rows) {
    const assignment = await ctx.db.get("assignments", row.assignmentId);
    if (!assignment || assignment.status !== "open") continue;
    const [chatZh, chatEn] = await chatNames(ctx, assignment.channelId, cache);
    const base = { title: assignment.title, kind: assignment.kind, chatZh, chatEn, link: taskLink(assignment._id) };

    if (assignment.kind === "event") {
      if (!assignment.startAt || eventEnd(assignment) <= now) continue;
      const item: DigestItem = { ...base, startAt: assignment.startAt, endAt: assignment.endAt, location: assignment.location };
      if (assignment.startAt < todayEnd) digest.today.push(item);
      else if (assignment.startAt < weekEnd) digest.events.push(item);
      continue;
    }

    if (row.status !== "assigned" && row.status !== "changes_requested") continue;
    const item: DigestItem = { ...base, dueAt: assignment.dueAt };
    if (assignment.dueAt !== undefined && assignment.dueAt < now) digest.today.push({ ...item, overdue: true });
    else if (assignment.dueAt !== undefined && assignment.dueAt < todayEnd) digest.today.push(item);
    else digest.todos.push(item);
  }

  const time = (item: DigestItem) => item.startAt ?? item.dueAt ?? Number.MAX_SAFE_INTEGER;
  digest.today.sort((a, b) => Number(b.overdue === true) - Number(a.overdue === true) || time(a) - time(b));
  digest.events.sort((a, b) => time(a) - time(b));
  digest.todos.sort((a, b) => time(a) - time(b));
  return {
    today: digest.today.slice(0, LIMITS.digestItems),
    events: digest.events.slice(0, LIMITS.digestItems),
    todos: digest.todos.slice(0, LIMITS.digestItems),
  };
}

export type DigestRecipient = Pick<Doc<"users">, "email" | "digestEmail" | "locale" | "nameZh" | "nameEn" | "name">;

export function digestAddress(user: DigestRecipient) {
  return user.digestEmail || user.email || null;
}
