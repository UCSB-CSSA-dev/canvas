import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { SEED_DEPARTMENTS } from "./constants";

export async function createDepartmentWithChannel(
  ctx: MutationCtx,
  department: Omit<Doc<"departments">, "_id" | "_creationTime">,
): Promise<Id<"departments">> {
  const departmentId = await ctx.db.insert("departments", department);
  await ctx.db.insert("channels", { type: "department", departmentId });
  await ctx.db.insert("channels", { type: "announcement", departmentId });
  return departmentId;
}

/**
 * Idempotent: creates the seed departments, the org channel, the org-wide announcement
 * channel, and any missing department announcement channels (added in Stage 2).
 */
export async function ensureSeed(ctx: MutationCtx) {
  const anyDepartment = await ctx.db.query("departments").first();
  if (!anyDepartment) {
    for (const [index, department] of SEED_DEPARTMENTS.entries()) {
      await createDepartmentWithChannel(ctx, { ...department, sortOrder: index });
    }
  }
  const orgChannel = await ctx.db
    .query("channels")
    .withIndex("by_type", (q) => q.eq("type", "org"))
    .first();
  if (!orgChannel) await ctx.db.insert("channels", { type: "org" });

  const announcements = await ctx.db
    .query("channels")
    .withIndex("by_type", (q) => q.eq("type", "announcement"))
    .collect();
  if (!announcements.some((c) => c.departmentId === undefined)) {
    await ctx.db.insert("channels", { type: "announcement" });
  }
  const withAnnouncement = new Set(announcements.map((c) => c.departmentId));
  for (const department of await ctx.db.query("departments").collect()) {
    if (!withAnnouncement.has(department._id)) {
      await ctx.db.insert("channels", { type: "announcement", departmentId: department._id });
    }
  }
}

export async function listActiveDepartments(ctx: QueryCtx) {
  const departments = await ctx.db.query("departments").collect();
  return departments
    .filter((d) => !d.archivedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "department"
  );
}
