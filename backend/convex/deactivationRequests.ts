import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { LIMITS } from "./lib/constants";
import { appError } from "./lib/errors";
import { findMembership, getPresidium } from "./lib/memberships";
import { notify } from "./lib/notify";
import { requireAdmin, requireApproved } from "./lib/permissions";
import { deactivateUser } from "./lib/users";

/**
 * A member asks 主席团 to deactivate their account. 主席团 reviews it from the roster
 * (and, once files exist, decides which of the member's files to keep).
 */
export const request = mutation({
  args: { reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await requireApproved(ctx);
    if (user.isSystemAdmin) throw appError("FORBIDDEN");
    const presidium = await getPresidium(ctx);
    if (presidium && (await findMembership(ctx, user._id, presidium._id))?.role === "lead") {
      throw appError("CHAIR_REQUIRED");
    }
    const reason = args.reason?.trim();
    if (reason && reason.length > LIMITS.deactivationReason) throw appError("INVALID", "reason");

    const existing = await ctx.db
      .query("deactivationRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (existing.some((r) => r.status === "pending")) throw appError("INVALID", "already_requested");

    const requestId = await ctx.db.insert("deactivationRequests", {
      userId: user._id,
      reason: reason || undefined,
      status: "pending",
    });
    await logAudit(ctx, {
      actorId: user._id,
      action: "user.deactivation_request",
      targetType: "deactivationRequest",
      targetId: requestId,
      subjectUserId: user._id,
    });
  },
});

export const cancel = mutation({
  args: { requestId: v.id("deactivationRequests") },
  handler: async (ctx, args) => {
    const { user } = await requireApproved(ctx);
    const request = await ctx.db.get("deactivationRequests", args.requestId);
    if (!request || request.userId !== user._id) throw appError("NOT_FOUND");
    if (request.status !== "pending") throw appError("ALREADY_REVIEWED");
    await ctx.db.patch("deactivationRequests", request._id, { status: "cancelled" });
  },
});

export const review = mutation({
  args: {
    requestId: v.id("deactivationRequests"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const request = await ctx.db.get("deactivationRequests", args.requestId);
    if (!request) throw appError("NOT_FOUND");
    if (request.status !== "pending") throw appError("ALREADY_REVIEWED");
    if (request.userId === viewer.user._id) throw appError("FORBIDDEN");
    const note = args.note?.trim();
    if (note && note.length > LIMITS.deactivationReason) throw appError("INVALID", "note");

    if (args.approve) {
      const target = await ctx.db.get("users", request.userId);
      if (!target) throw appError("NOT_FOUND");
      await deactivateUser(ctx, { actorId: viewer.user._id, target, requestId: request._id });
      if (note) await ctx.db.patch("deactivationRequests", request._id, { reviewNote: note });
      return;
    }

    await ctx.db.patch("deactivationRequests", request._id, {
      status: "declined",
      reviewedBy: viewer.user._id,
      reviewedAt: Date.now(),
      reviewNote: note || undefined,
    });
    await notify(ctx, request.userId, {
      type: "deactivation_reviewed",
      params: { approved: false, note: note ?? "" },
      link: "/settings/",
    });
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "user.deactivation_decline",
      targetType: "deactivationRequest",
      targetId: request._id,
      subjectUserId: request.userId,
    });
  },
});
