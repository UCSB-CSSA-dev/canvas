import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { channelMemberRow, readBaseline, retentionDays } from "./lib/channels";
import { LIMITS } from "./lib/constants";
import { ensureSeed } from "./lib/departments";
import { deleteMessage } from "./lib/messages";
import { chatLink } from "./lib/notify";

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

/** Hourly: keeps seed data in place and finishes data migrations without needing a deploy-time script. */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ensureSeed(ctx);
    const legacy = await ctx.db
      .query("channels")
      .withIndex("by_type", (q) => q.eq("type", "announcement"))
      .first();
    if (legacy) await ctx.scheduler.runAfter(0, internal.maintenance.mergeAnnouncementChannels, {});
  },
});

const MERGE_BATCH = 200;

/**
 * Folds each legacy announcement channel into the org chat (org-wide) or its department's chat:
 * messages move over flagged as announcements, the old read state becomes announcementsReadAt,
 * chat apps and notification links follow, then the channel is deleted. Idempotent; reschedules
 * itself until no announcement channel is left.
 */
export const mergeAnnouncementChannels = internalMutation({
  args: {},
  handler: async (ctx) => {
    const source = await ctx.db
      .query("channels")
      .withIndex("by_type", (q) => q.eq("type", "announcement"))
      .first();
    if (!source) return;
    const departmentId = source.departmentId;
    const target = departmentId
      ? (
          await ctx.db
            .query("channels")
            .withIndex("by_department", (q) => q.eq("departmentId", departmentId))
            .collect()
        ).find((c) => c.type === "department")
      : await ctx.db
          .query("channels")
          .withIndex("by_type", (q) => q.eq("type", "org"))
          .first();

    const batch = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", source._id))
      .take(MERGE_BATCH);
    for (const message of batch) {
      // System lines (retention changes) only made sense in the old channel.
      if (!target || message.kind === "system") {
        await deleteMessage(ctx, message);
        continue;
      }
      await ctx.db.patch("messages", message._id, { channelId: target._id, announcement: true });
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();
      for (const row of notifications) {
        await ctx.db.patch("notifications", row._id, {
          link: chatLink(target._id, message._id),
          params: { ...row.params, channelId: target._id },
        });
      }
    }
    if (batch.length === MERGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.maintenance.mergeAnnouncementChannels, {});
      return;
    }

    const members = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", source._id))
      .collect();
    for (const row of members) {
      await ctx.db.delete("channelMembers", row._id);
      const user = target ? await ctx.db.get("users", row.userId) : null;
      if (!target || !user) continue;
      const existing = await channelMemberRow(ctx, target._id, user._id);
      if (existing) {
        await ctx.db.patch("channelMembers", existing._id, {
          announcementsReadAt: Math.max(existing.announcementsReadAt ?? 0, row.lastReadAt),
        });
      } else {
        await ctx.db.insert("channelMembers", {
          channelId: target._id,
          userId: user._id,
          lastReadAt: readBaseline(user),
          announcementsReadAt: row.lastReadAt,
        });
      }
    }

    const apps = await ctx.db
      .query("chatApps")
      .withIndex("by_channel_status", (q) => q.eq("channelId", source._id))
      .collect();
    if (apps.length > 0) {
      const oldParam = `c=${source._id}`;
      for (const app of apps) {
        if (target) await ctx.db.patch("chatApps", app._id, { channelId: target._id });
        else await ctx.db.delete("chatApps", app._id);
      }
      for (const row of await ctx.db.query("notifications").collect()) {
        if (!row.link?.includes(oldParam)) continue;
        if (target) await ctx.db.patch("notifications", row._id, { link: row.link.replace(oldParam, `c=${target._id}`) });
        else await ctx.db.delete("notifications", row._id);
      }
    }

    if (target && (source.lastMessageAt ?? 0) > (target.lastMessageAt ?? 0)) {
      await ctx.db.patch("channels", target._id, { lastMessageAt: source.lastMessageAt });
    }
    await ctx.db.delete("channels", source._id);
    await ctx.scheduler.runAfter(0, internal.maintenance.mergeAnnouncementChannels, {});
  },
});
