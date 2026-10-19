import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { appError } from "./lib/errors";
import { departmentLeads, findMembership, getPresidium } from "./lib/memberships";
import { requireAdmin, requireApproved } from "./lib/permissions";

/**
 * The 主席 hands the role to a 副主席 and becomes 副主席 themselves.
 * Only the current 主席 (or a system admin) can do this.
 */
export const transferChair = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const presidium = await getPresidium(ctx);
    if (!presidium) throw appError("NOT_FOUND");
    const target = await findMembership(ctx, args.userId, presidium._id);
    if (!target || target.role !== "member") throw appError("INVALID", "not_vice_chair");

    const chairs = await departmentLeads(ctx, presidium._id);
    const viewerIsChair = chairs.some((m) => m.userId === viewer.user._id);
    if (!viewerIsChair && !viewer.isSystemAdmin) throw appError("FORBIDDEN");

    for (const chair of chairs) {
      await ctx.db.patch("departmentMemberships", chair._id, { role: "member", wasChair: true });
    }
    await ctx.db.patch("departmentMemberships", target._id, { role: "lead" });
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "presidium.transfer_chair",
      targetType: "department",
      targetId: presidium._id,
      subjectUserId: args.userId,
      metadata: { from: chairs.map((m) => m.userId) },
    });
  },
});

/**
 * A presidium member moves a 部长 up into 主席团 as 副主席.
 * Their 部长 seats in regular departments are vacated.
 */
export const promoteToViceChair = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const presidium = await getPresidium(ctx);
    if (!presidium) throw appError("NOT_FOUND");
    const target = await ctx.db.get("users", args.userId);
    if (!target || target.status !== "approved") throw appError("NOT_FOUND");
    if (await findMembership(ctx, target._id, presidium._id)) {
      throw appError("INVALID", "already_presidium");
    }

    const memberships = await ctx.db
      .query("departmentMemberships")
      .withIndex("by_user", (q) => q.eq("userId", target._id))
      .collect();
    const leadSeats = memberships.filter((m) => m.role === "lead");
    if (leadSeats.length === 0) throw appError("INVALID", "not_a_lead");

    for (const seat of leadSeats) await ctx.db.delete("departmentMemberships", seat._id);
    await ctx.db.insert("departmentMemberships", {
      userId: target._id,
      departmentId: presidium._id,
      role: "member",
      addedBy: viewer.user._id,
    });
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "presidium.promote",
      targetType: "department",
      targetId: presidium._id,
      subjectUserId: target._id,
      metadata: { vacated: leadSeats.map((m) => m.departmentId) },
    });
  },
});

/**
 * A presidium member steps down and becomes 前主席 / 前副主席.
 * The 主席 must transfer the role first. System admins can retire anyone.
 */
export const retire = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    if (args.userId !== viewer.user._id && !viewer.isSystemAdmin) throw appError("FORBIDDEN");
    const presidium = await getPresidium(ctx);
    if (!presidium) throw appError("NOT_FOUND");
    const membership = await findMembership(ctx, args.userId, presidium._id);
    if (!membership) throw appError("NOT_FOUND");
    if (membership.role === "lead") throw appError("CHAIR_REQUIRED");

    const role = membership.wasChair ? "lead" : "member";
    await ctx.db.delete("departmentMemberships", membership._id);
    await ctx.db.insert("formerPresidium", { userId: args.userId, role, retiredAt: Date.now() });
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "presidium.retire",
      targetType: "department",
      targetId: presidium._id,
      subjectUserId: args.userId,
      metadata: { title: role === "lead" ? "former_chair" : "former_vice_chair" },
    });
  },
});
