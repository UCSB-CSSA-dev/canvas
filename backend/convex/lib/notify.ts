import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { LIMITS, type NotificationType } from "./constants";
import { queuePush } from "./push";

export type NotificationInput = {
  type: NotificationType;
  /** Rendered on the client through next-intl; ids are resolved to names when listed. */
  params: Record<string, unknown>;
  link?: string;
  messageId?: Id<"messages">;
};

function pushFor(input: NotificationInput) {
  return { type: input.type, params: input.params, link: input.link, tag: input.messageId };
}

export async function notify(ctx: MutationCtx, userId: Id<"users">, input: NotificationInput) {
  await ctx.db.insert("notifications", { userId, ...input });
  await queuePush(ctx, [userId], pushFor(input));
}

/** Inserts the first batch now and schedules the rest, so big audiences don't hit write limits. */
export async function notifyMany(ctx: MutationCtx, userIds: Id<"users">[], input: NotificationInput) {
  const unique = [...new Set(userIds)];
  const now = unique.slice(0, LIMITS.fanoutBatch);
  for (const userId of now) await ctx.db.insert("notifications", { userId, ...input });
  await queuePush(ctx, now, pushFor(input));
  const rest = unique.slice(LIMITS.fanoutBatch);
  if (rest.length > 0) {
    await ctx.scheduler.runAfter(0, internal.notifications.fanout, { userIds: rest, input });
  }
}

export function chatLink(channelId: Id<"channels">, messageId?: Id<"messages">) {
  return messageId ? `/chat/?c=${channelId}&m=${messageId}` : `/chat/?c=${channelId}`;
}
