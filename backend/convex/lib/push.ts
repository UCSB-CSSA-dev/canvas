import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { NOTIFICATION_TYPES } from "./constants";
import type { PushInput } from "./pushText";

export const pushInputValidator = v.object({
  type: v.union(...NOTIFICATION_TYPES.map((t) => v.literal(t)), v.literal("dm"), v.literal("test")),
  params: v.any(),
  link: v.optional(v.string()),
  tag: v.optional(v.string()),
});

/** Schedules a Web Push to the users that have at least one subscribed device. */
export async function queuePush(ctx: MutationCtx, userIds: Id<"users">[], input: PushInput) {
  const targets: Id<"users">[] = [];
  for (const userId of new Set(userIds)) {
    const device = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (device) targets.push(userId);
  }
  if (targets.length > 0) {
    await ctx.scheduler.runAfter(0, internal.pushNode.send, { userIds: targets, input });
  }
}
