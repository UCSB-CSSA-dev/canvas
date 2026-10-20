import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { retentionDays } from "./lib/channels";
import { LIMITS } from "./lib/constants";
import { ensureSeed } from "./lib/departments";
import { deleteMessage } from "./lib/messages";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hourly: deletes messages older than their chat's retention, LIMITS.purgeBatch at a time
 * (rescheduling itself until done), and removes ended groups once their retention has passed.
 */
export const purgeMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let budget = LIMITS.purgeBatch;
    for (const channel of await ctx.db.query("channels").collect()) {
      if (budget <= 0) break;
      const cutoff = now - retentionDays(channel) * DAY_MS;
      const expired = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", channel._id).lt("_creationTime", cutoff))
        .take(budget);
      for (const message of expired) await deleteMessage(ctx, message);
      budget -= expired.length;

      if (channel.type === "group" && channel.endedAt && channel.endedAt < cutoff && budget > 0) {
        const remaining = await ctx.db
          .query("messages")
          .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
          .first();
        if (remaining) continue;
        for (const table of ["channelMembers", "groupDepartments"] as const) {
          const rows = await ctx.db
            .query(table)
            .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
            .collect();
          for (const row of rows) await ctx.db.delete(table, row._id);
        }
        await ctx.db.delete("channels", channel._id);
      }
    }
    if (budget <= 0) await ctx.scheduler.runAfter(0, internal.maintenance.purgeMessages, {});
  },
});

/** Hourly: keeps seed data (announcement channels) in place without needing a deploy-time script. */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ensureSeed(ctx);
  },
});
