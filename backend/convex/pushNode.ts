"use node";

import { v } from "convex/values";
import webpush, { WebPushError } from "web-push";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { pushInputValidator } from "./lib/push";
import { pushText } from "./lib/pushText";

const URGENT = new Set(["dm", "chat", "mention", "reply", "announcement", "test"]);

/** The device subscribed with another VAPID key (Apple: VapidPkHashMismatch; FCM: credentials don't correspond). */
function keyMismatch(error: WebPushError) {
  return error.statusCode === 403 && /VapidPkHashMismatch|do not correspond/i.test(error.body ?? "");
}

export const send = internalAction({
  args: { userIds: v.array(v.id("users")), input: pushInputValidator },
  handler: async (ctx, { userIds, input }) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return;
    const vapidDetails = {
      subject: process.env.VAPID_SUBJECT || "mailto:noreply@ucsb.edu",
      publicKey,
      privateKey,
    };

    const { devices, lookup } = await ctx.runQuery(internal.push.targets, { userIds, input });
    const gone: string[] = [];
    let failed = 0;
    await Promise.all(
      devices.map(async (device) => {
        const payload = JSON.stringify({ ...pushText(input, device.locale, lookup), link: input.link, tag: input.tag });
        try {
          await webpush.sendNotification(
            { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
            payload,
            { vapidDetails, TTL: 24 * 60 * 60, urgency: URGENT.has(input.type) ? "high" : "normal" },
          );
        } catch (error) {
          if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410 || keyMismatch(error))) {
            gone.push(device.endpoint);
          } else {
            failed++;
            console.error(
              "push failed",
              new URL(device.endpoint).host,
              error instanceof WebPushError ? `${error.statusCode} ${error.body}` : error,
            );
          }
        }
      }),
    );
    console.log(
      `push ${input.type}: ${devices.length - gone.length - failed}/${devices.length} delivered, ${gone.length} expired, ${failed} failed`,
    );
    if (gone.length > 0) await ctx.runMutation(internal.push.removeEndpoints, { endpoints: gone });
  },
});
