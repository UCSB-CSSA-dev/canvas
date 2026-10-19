import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { LIMITS } from "./constants";
import { appError } from "./errors";
import type { MembershipRole } from "./types";

export async function findMembership(
  ctx: QueryCtx,
  userId: Id<"users">,
  departmentId: Id<"departments">,
): Promise<Doc<"departmentMemberships"> | null> {
  return ctx.db
    .query("departmentMemberships")
    .withIndex("by_user_department", (q) =>
      q.eq("userId", userId).eq("departmentId", departmentId),
    )
    .unique();
}

export async function departmentLeads(ctx: QueryCtx, departmentId: Id<"departments">) {
  const rows = await ctx.db
    .query("departmentMemberships")
    .withIndex("by_department", (q) => q.eq("departmentId", departmentId))
    .collect();
  return rows.filter((m) => m.role === "lead");
}

export async function getPresidium(ctx: QueryCtx): Promise<Doc<"departments"> | null> {
  const rows = await ctx.db
    .query("departments")
    .withIndex("by_kind", (q) => q.eq("kind", "presidium"))
    .collect();
  return rows.find((d) => !d.archivedAt) ?? null;
}

/**
 * Why `userId` can't become a lead of `department`, or null if they can.
 * 主席团 has exactly one 主席; regular departments have at most LIMITS.leadsPerDepartment 部长.
 */
export async function leadBlocker(
  ctx: QueryCtx,
  department: Doc<"departments">,
  userId: Id<"users"> | null,
): Promise<"CHAIR_EXISTS" | "TOO_MANY_LEADS" | null> {
  const others = (await departmentLeads(ctx, department._id)).filter((m) => m.userId !== userId);
  if (department.kind === "presidium") return others.length > 0 ? "CHAIR_EXISTS" : null;
  return others.length >= LIMITS.leadsPerDepartment ? "TOO_MANY_LEADS" : null;
}

export type UpsertResult = "created" | "updated" | "unchanged";

/** Raw insert-or-update. Prefer `assignMembership`, which enforces the hierarchy rules. */
export async function upsertMembership(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    departmentId: Id<"departments">;
    role: MembershipRole;
    addedBy?: Id<"users">;
  },
): Promise<UpsertResult> {
  const existing = await findMembership(ctx, args.userId, args.departmentId);
  if (!existing) {
    await ctx.db.insert("departmentMemberships", args);
    return "created";
  }
  if (existing.role === args.role) return "unchanged";
  await ctx.db.patch("departmentMemberships", existing._id, { role: args.role });
  return "updated";
}

/** Insert or change a membership, enforcing the lead limits and that the 主席 can't be demoted. */
export async function assignMembership(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    department: Doc<"departments">;
    role: MembershipRole;
    addedBy?: Id<"users">;
  },
): Promise<UpsertResult> {
  const { department, ...rest } = args;
  if (args.role === "lead") {
    const blocker = await leadBlocker(ctx, department, args.userId);
    if (blocker) throw appError(blocker);
  } else if (department.kind === "presidium") {
    const existing = await findMembership(ctx, args.userId, department._id);
    if (existing?.role === "lead") throw appError("CHAIR_REQUIRED");
  }
  return upsertMembership(ctx, { ...rest, departmentId: department._id });
}
