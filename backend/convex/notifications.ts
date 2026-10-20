import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { LIMITS, NOTIFICATION_TYPES } from "./lib/constants";
import { appError } from "./lib/errors";
import { notifyMany } from "./lib/notify";
import { requireApproved, requireViewer } from "./lib/permissions";
import { getUserSummaries, type UserSummary } from "./lib/users";

const USER_PARAMS = ["actorId", "proposerId", "reviewerId", "approverId", "userId", "authorId"] as const;

export type NotificationView = {
  _id: Id<"notifications">;
  _creationTime: number;
  type: Doc<"notifications">["type"];
  params: Record<string, unknown>;
  link?: string;
  readAt?: number;
  people: UserSummary[];
  departments: { _id: Id<"departments">; nameZh: string; nameEn: string }[];
};

/** Continues a notifyMany fanout in batches. */
export const fanout = internalMutation({
  args: {
    userIds: v.array(v.id("users")),
    input: v.object({
      type: v.union(...NOTIFICATION_TYPES.map((t) => v.literal(t))),
      params: v.any(),
      link: v.optional(v.string()),
      messageId: v.optional(v.id("messages")),
    }),
  },
  handler: async (ctx, args) => {
    if (args.input.messageId && !(await ctx.db.get("messages", args.input.messageId))) return;
    await notifyMany(ctx, args.userIds, args.input);
  },
});

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const page = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", viewer.user._id))
      .order("desc")
      .paginate(args.paginationOpts);

    const userIds = new Set<Id<"users">>();
    const departmentIds = new Set<Id<"departments">>();
    for (const n of page.page) {
      const params = (n.params ?? {}) as Record<string, unknown>;
      for (const key of USER_PARAMS) {
        const id = typeof params[key] === "string" ? ctx.db.normalizeId("users", params[key]) : null;
        if (id) userIds.add(id);
      }
      const departmentId =
        typeof params.departmentId === "string" ? ctx.db.normalizeId("departments", params.departmentId) : null;
      if (departmentId) departmentIds.add(departmentId);
    }
    const people = await getUserSummaries(ctx, [...userIds]);
    const departments = new Map<Id<"departments">, NotificationView["departments"][number]>();
    for (const id of departmentIds) {
      const department = await ctx.db.get("departments", id);
      if (department) departments.set(id, { _id: id, nameZh: department.nameZh, nameEn: department.nameEn });
    }

    return {
      ...page,
      page: page.page.map((n): NotificationView => {
        const params = (n.params ?? {}) as Record<string, unknown>;
        return {
          _id: n._id,
          _creationTime: n._creationTime,
          type: n.type,
          params,
          link: n.link,
          readAt: n.readAt,
          people: USER_PARAMS.flatMap((key) => {
            const person = people.get(params[key] as Id<"users">);
            return person ? [person] : [];
          }),
          departments: departments.has(params.departmentId as Id<"departments">)
            ? [departments.get(params.departmentId as Id<"departments">)!]
            : [],
        };
      }),
    };
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    if (viewer.user.status !== "approved") return 0;
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", viewer.user._id).eq("readAt", undefined))
      .take(100);
    return unread.length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const notification = await ctx.db.get("notifications", args.notificationId);
    if (!notification || notification.userId !== viewer.user._id) throw appError("NOT_FOUND");
    if (!notification.readAt) await ctx.db.patch("notifications", notification._id, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireApproved(ctx);
    const now = Date.now();
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", viewer.user._id).eq("readAt", undefined))
      .take(LIMITS.purgeBatch);
    for (const n of unread) await ctx.db.patch("notifications", n._id, { readAt: now });
  },
});

/** Daily: delete read notifications older than LIMITS.notificationRetentionDays. */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - LIMITS.notificationRetentionDays * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("notifications")
      .withIndex("by_readAt", (q) => q.gt("readAt", 0).lt("readAt", cutoff))
      .take(LIMITS.purgeBatch);
    for (const n of old) await ctx.db.delete("notifications", n._id);
    if (old.length === LIMITS.purgeBatch) {
      await ctx.scheduler.runAfter(0, internal.notifications.cleanup, {});
    }
  },
});
