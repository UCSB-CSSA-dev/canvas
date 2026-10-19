import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { LIMITS } from "./lib/constants";
import { isAllowedEmail, parseEmailList } from "./lib/email";
import { appError } from "./lib/errors";
import { assignMembership, findMembership, leadBlocker } from "./lib/memberships";
import { canPreApprove, isLeadOf, requireApproved } from "./lib/permissions";
import { claimPreApprovals } from "./lib/preApprovals";
import { membershipRole } from "./schema";

export type PreApprovalResult =
  | "created"
  | "updated"
  | "applied"
  | "approved_pending"
  | "already_member"
  | "needs_review"
  | "invalid";

export const createMany = mutation({
  args: {
    emails: v.array(v.string()),
    departmentId: v.id("departments"),
    role: membershipRole,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const department = await ctx.db.get("departments", args.departmentId);
    if (!department || department.archivedAt) throw appError("NOT_FOUND");
    if (!canPreApprove(viewer, department, args.role)) throw appError("FORBIDDEN");

    const emails = parseEmailList(args.emails);
    if (emails.length === 0 || emails.length > LIMITS.preApprovalBatch) {
      throw appError("INVALID", "emails");
    }
    const note = args.note?.trim() || undefined;
    if (note && note.length > LIMITS.preApprovalNote) throw appError("INVALID", "note");
    if (department.kind === "presidium" && args.role === "lead") {
      const blocker = await leadBlocker(ctx, department, null);
      if (blocker) throw appError(blocker);
    }

    const actorId = viewer.user._id;
    const results: { email: string; result: PreApprovalResult }[] = [];

    for (const email of emails) {
      if (!isAllowedEmail(email)) {
        results.push({ email, result: "invalid" });
        continue;
      }
      const audit = (action: string, targetId: string, subjectUserId?: typeof actorId) =>
        logAudit(ctx, {
          actorId,
          action,
          targetType: "preApproval",
          targetId,
          subjectUserId,
          metadata: { email, departmentId: department._id, role: args.role },
        });

      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();

      if (user && (user.status === "rejected" || user.status === "deactivated")) {
        results.push({ email, result: "needs_review" });
        continue;
      }

      if (user && user.status === "approved") {
        const existing = await findMembership(ctx, user._id, department._id);
        if (existing && (existing.role === args.role || !viewer.isAdmin)) {
          results.push({ email, result: "already_member" });
          continue;
        }
        await assignMembership(ctx, {
          userId: user._id,
          department,
          role: args.role,
          addedBy: actorId,
        });
        const now = Date.now();
        const rowId = await ctx.db.insert("preApprovals", {
          email,
          departmentId: department._id,
          role: args.role,
          note,
          createdBy: actorId,
          claimedAt: now,
          claimedBy: user._id,
        });
        await audit("preapproval.create", rowId, user._id);
        results.push({ email, result: "applied" });
        continue;
      }

      const active = (
        await ctx.db
          .query("preApprovals")
          .withIndex("by_email_department", (q) =>
            q.eq("email", email).eq("departmentId", department._id),
          )
          .collect()
      ).find((row) => !row.claimedAt && !row.revokedAt);

      if (active) {
        if (active.role !== args.role) {
          await ctx.db.patch("preApprovals", active._id, { role: args.role, note });
          await audit("preapproval.update", active._id, user?._id);
        }
        results.push({ email, result: "updated" });
      } else {
        const rowId = await ctx.db.insert("preApprovals", {
          email,
          departmentId: department._id,
          role: args.role,
          note,
          createdBy: actorId,
        });
        await audit("preapproval.create", rowId, user?._id);
        results.push({ email, result: "created" });
      }

      if (user && user.status === "pending") {
        await claimPreApprovals(ctx, user);
        results[results.length - 1] = { email, result: "approved_pending" };
      }
    }
    return results;
  },
});

export const revoke = mutation({
  args: { preApprovalId: v.id("preApprovals") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const row = await ctx.db.get("preApprovals", args.preApprovalId);
    if (!row || row.claimedAt || row.revokedAt) throw appError("NOT_FOUND");
    const allowed =
      viewer.isAdmin || (row.role === "member" && isLeadOf(viewer, row.departmentId));
    if (!allowed) throw appError("FORBIDDEN");

    await ctx.db.patch("preApprovals", row._id, {
      revokedAt: Date.now(),
      revokedBy: viewer.user._id,
    });
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "preapproval.revoke",
      targetType: "preApproval",
      targetId: row._id,
      metadata: { email: row.email, departmentId: row.departmentId },
    });
  },
});
