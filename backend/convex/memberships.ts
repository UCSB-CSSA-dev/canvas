import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { appError } from "./lib/errors";
import { trackLeadership } from "./lib/groups";
import { assignMembership, findMembership } from "./lib/memberships";
import { notify } from "./lib/notify";
import { isLeadOf, requireApproved } from "./lib/permissions";
import { membershipRole } from "./schema";

export const add = mutation({
  args: { userId: v.id("users"), departmentId: v.id("departments"), role: membershipRole },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const department = await ctx.db.get("departments", args.departmentId);
    if (!department || department.archivedAt) throw appError("NOT_FOUND");
    const target = await ctx.db.get("users", args.userId);
    if (!target || target.status !== "approved") throw appError("NOT_FOUND");

    const leadAddingMember =
      department.kind === "regular" && args.role === "member" && isLeadOf(viewer, department._id);
    if (!viewer.isAdmin && !leadAddingMember) throw appError("FORBIDDEN");

    const existing = await findMembership(ctx, target._id, department._id);
    if (existing && !viewer.isAdmin) throw appError("INVALID", "already_member");

    const result = await trackLeadership(ctx, [department._id], viewer.user._id, () =>
      assignMembership(ctx, {
        userId: target._id,
        department,
        role: args.role,
        addedBy: viewer.user._id,
      }),
    );
    if (result === "unchanged") return;
    if (result === "created" && target._id !== viewer.user._id) {
      await notify(ctx, target._id, {
        type: "added_to_department",
        params: { actorId: viewer.user._id, departmentId: department._id, role: args.role },
        link: "/roster/",
      });
    }
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: result === "created" ? "membership.add" : "membership.role_change",
      targetType: "department",
      targetId: department._id,
      subjectUserId: target._id,
      metadata: { role: args.role },
    });
  },
});

export const remove = mutation({
  args: { membershipId: v.id("departmentMemberships") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const membership = await ctx.db.get("departmentMemberships", args.membershipId);
    if (!membership) throw appError("NOT_FOUND");
    const department = await ctx.db.get("departments", membership.departmentId);

    const leadRemovingMember =
      membership.role === "member" &&
      membership.userId !== viewer.user._id &&
      isLeadOf(viewer, membership.departmentId);
    if (!viewer.isAdmin && !leadRemovingMember) throw appError("FORBIDDEN");
    if (department?.kind === "presidium" && membership.role === "lead") {
      throw appError("CHAIR_REQUIRED");
    }

    await trackLeadership(ctx, [membership.departmentId], viewer.user._id, () =>
      ctx.db.delete("departmentMemberships", membership._id),
    );
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "membership.remove",
      targetType: "department",
      targetId: membership.departmentId,
      subjectUserId: membership.userId,
      metadata: { role: membership.role },
    });
  },
});

/**
 * Admins change any role (subject to the 主席 and lead-count rules).
 * A 部长 can promote a 部员 of their own department to 部长.
 * Making someone 主席 while one exists goes through presidium.transferChair instead.
 */
export const setRole = mutation({
  args: { membershipId: v.id("departmentMemberships"), role: membershipRole },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const membership = await ctx.db.get("departmentMemberships", args.membershipId);
    if (!membership) throw appError("NOT_FOUND");
    const department = await ctx.db.get("departments", membership.departmentId);
    if (!department || department.archivedAt) throw appError("NOT_FOUND");

    const leadPromoting =
      department.kind === "regular" &&
      args.role === "lead" &&
      membership.role === "member" &&
      isLeadOf(viewer, department._id);
    if (!viewer.isAdmin && !leadPromoting) throw appError("FORBIDDEN");
    if (membership.role === args.role) return;

    await trackLeadership(ctx, [department._id], viewer.user._id, () =>
      assignMembership(ctx, { userId: membership.userId, department, role: args.role }),
    );
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "membership.role_change",
      targetType: "department",
      targetId: membership.departmentId,
      subjectUserId: membership.userId,
      metadata: { from: membership.role, to: args.role },
    });
  },
});
