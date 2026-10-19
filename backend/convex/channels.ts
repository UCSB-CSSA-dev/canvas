import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { LIMITS } from "./lib/constants";
import { appError } from "./lib/errors";
import { canReadChannel, requireApproved, type ViewerContext } from "./lib/permissions";
import { toUserSummary, type UserSummary } from "./lib/users";

export type ChannelView = {
  _id: Id<"channels">;
  type: Doc<"channels">["type"];
  departmentId?: Id<"departments">;
  nameZh?: string;
  nameEn?: string;
  otherUser?: UserSummary;
  lastMessageAt?: number;
  unread: number;
};

async function readState(ctx: QueryCtx, channelId: Id<"channels">, userId: Id<"users">) {
  return ctx.db
    .query("channelMembers")
    .withIndex("by_channel_user", (q) => q.eq("channelId", channelId).eq("userId", userId))
    .unique();
}

async function toChannelView(
  ctx: QueryCtx,
  viewer: ViewerContext,
  channel: Doc<"channels">,
): Promise<ChannelView> {
  const state = await readState(ctx, channel._id, viewer.user._id);
  const lastReadAt = state?.lastReadAt ?? viewer.user.reviewedAt ?? viewer.user._creationTime;
  const unreadMessages = await ctx.db
    .query("messages")
    .withIndex("by_channel", (q) =>
      q.eq("channelId", channel._id).gt("_creationTime", lastReadAt),
    )
    .take(LIMITS.unreadCountCap + 1);
  const unread = unreadMessages.filter((m) => m.authorId !== viewer.user._id).length;

  const view: ChannelView = {
    _id: channel._id,
    type: channel.type,
    departmentId: channel.departmentId,
    lastMessageAt: channel.lastMessageAt,
    unread,
  };

  if (channel.type === "department" && channel.departmentId) {
    const department = await ctx.db.get("departments", channel.departmentId);
    view.nameZh = department?.nameZh;
    view.nameEn = department?.nameEn;
  } else if (channel.type === "dm") {
    const members = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
      .collect();
    const otherId = members.find((m) => m.userId !== viewer.user._id)?.userId;
    const other = otherId ? await ctx.db.get("users", otherId) : null;
    if (other) view.otherUser = toUserSummary(other);
  }
  return view;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireApproved(ctx);

    const org = await ctx.db
      .query("channels")
      .withIndex("by_type", (q) => q.eq("type", "org"))
      .collect();

    const departmentChannels = (
      await ctx.db
        .query("channels")
        .withIndex("by_type", (q) => q.eq("type", "department"))
        .collect()
    ).filter(
      (c) =>
        c.departmentId !== undefined &&
        (viewer.isAdmin || viewer.memberDepartmentIds.includes(c.departmentId)),
    );
    const departments = new Map(
      (await ctx.db.query("departments").collect()).map((d) => [d._id, d]),
    );
    const activeDepartmentChannels = departmentChannels
      .filter((c) => {
        const d = c.departmentId && departments.get(c.departmentId);
        return d && !d.archivedAt;
      })
      .sort(
        (a, b) =>
          (departments.get(a.departmentId!)?.sortOrder ?? 0) -
          (departments.get(b.departmentId!)?.sortOrder ?? 0),
      );

    const myRows = await ctx.db
      .query("channelMembers")
      .withIndex("by_user", (q) => q.eq("userId", viewer.user._id))
      .collect();
    const dmChannels = (
      await Promise.all(myRows.map((row) => ctx.db.get("channels", row.channelId)))
    ).filter((c): c is Doc<"channels"> => c?.type === "dm");

    const views = async (list: Doc<"channels">[]) =>
      Promise.all(list.map((c) => toChannelView(ctx, viewer, c)));

    return {
      org: await views(org),
      departments: await views(activeDepartmentChannels),
      dms: (await views(dmChannels)).sort(
        (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
      ),
    };
  },
});

export const get = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel || !(await canReadChannel(ctx, viewer, channel))) return null;
    return toChannelView(ctx, viewer, channel);
  },
});

export const getOrCreateDm = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    if (args.otherUserId === viewer.user._id) throw appError("INVALID", "self");
    const other = await ctx.db.get("users", args.otherUserId);
    if (!other || other.status !== "approved") throw appError("NOT_FOUND");

    const dmKey = [viewer.user._id, other._id].sort().join(":");
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_dmKey", (q) => q.eq("dmKey", dmKey))
      .unique();
    if (existing) return existing._id;

    const now = Date.now();
    const channelId = await ctx.db.insert("channels", {
      type: "dm",
      dmKey,
      createdBy: viewer.user._id,
    });
    for (const userId of [viewer.user._id, other._id]) {
      await ctx.db.insert("channelMembers", { channelId, userId, lastReadAt: now });
    }
    return channelId;
  },
});

export const markRead = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel || !(await canReadChannel(ctx, viewer, channel))) throw appError("NOT_FOUND");
    const state = await readState(ctx, channel._id, viewer.user._id);
    const now = Date.now();
    if (state) await ctx.db.patch("channelMembers", state._id, { lastReadAt: now });
    else
      await ctx.db.insert("channelMembers", {
        channelId: channel._id,
        userId: viewer.user._id,
        lastReadAt: now,
      });
  },
});
