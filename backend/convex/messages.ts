import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { LIMITS } from "./lib/constants";
import { appError } from "./lib/errors";
import { canPostInChannel, canReadChannel, requireApproved } from "./lib/permissions";
import { getUserSummaries } from "./lib/users";

export const list = query({
  args: { channelId: v.id("channels"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel || !(await canReadChannel(ctx, viewer, channel))) throw appError("NOT_FOUND");

    const result = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
      .order("desc")
      .paginate(args.paginationOpts);

    const authors = await getUserSummaries(
      ctx,
      result.page.map((m) => m.authorId),
    );
    return {
      ...result,
      page: result.page.map((m) => ({
        _id: m._id,
        _creationTime: m._creationTime,
        body: m.body,
        author: authors.get(m.authorId) ?? null,
      })),
    };
  },
});

export const send = mutation({
  args: { channelId: v.id("channels"), body: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel || !(await canPostInChannel(ctx, viewer, channel))) {
      throw appError("NOT_FOUND");
    }
    const body = args.body.trim();
    if (!body || body.length > LIMITS.messageBody) throw appError("INVALID", "body");

    const messageId = await ctx.db.insert("messages", {
      channelId: channel._id,
      authorId: viewer.user._id,
      body,
    });
    const now = Date.now();
    await ctx.db.patch("channels", channel._id, { lastMessageAt: now });

    const state = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channel._id).eq("userId", viewer.user._id),
      )
      .unique();
    if (state) await ctx.db.patch("channelMembers", state._id, { lastReadAt: now });
    else
      await ctx.db.insert("channelMembers", {
        channelId: channel._id,
        userId: viewer.user._id,
        lastReadAt: now,
      });
    return messageId;
  },
});
