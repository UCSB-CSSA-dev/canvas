import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { logAudit } from "./audit";
import { leadBlocker, upsertMembership } from "./memberships";

export async function activePreApprovalsForEmail(
  ctx: QueryCtx,
  email: string,
): Promise<Doc<"preApprovals">[]> {
  const rows = await ctx.db
    .query("preApprovals")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
  return rows.filter((row) => !row.claimedAt && !row.revokedAt);
}

/**
 * Approves the user and places them into every department they were pre-approved for.
 * Returns the number of pre-approvals claimed (0 means nothing happened).
 */
export async function claimPreApprovals(ctx: MutationCtx, user: Doc<"users">): Promise<number> {
  if (!user.email) return 0;
  const rows = await activePreApprovalsForEmail(ctx, user.email);
  if (rows.length === 0) return 0;

  const now = Date.now();
  for (const row of rows) {
    const department = await ctx.db.get("departments", row.departmentId);
    // If the lead seat filled up since the pre-approval was made, join as 部员 / 副主席.
    const role =
      row.role === "lead" && department && (await leadBlocker(ctx, department, user._id))
        ? "member"
        : row.role;
    await upsertMembership(ctx, {
      userId: user._id,
      departmentId: row.departmentId,
      role,
      addedBy: row.createdBy,
    });
    await ctx.db.patch("preApprovals", row._id, { claimedAt: now, claimedBy: user._id });
    await logAudit(ctx, {
      actorId: user._id,
      action: "preapproval.claim",
      targetType: "preApproval",
      targetId: row._id,
      subjectUserId: user._id,
      metadata: { departmentId: row.departmentId, role },
    });
  }

  if (user.status !== "approved") {
    await ctx.db.patch("users", user._id, {
      status: "approved",
      reviewedBy: rows[0].createdBy,
      reviewedAt: now,
    });
  }
  return rows.length;
}
