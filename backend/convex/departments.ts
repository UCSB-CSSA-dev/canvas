import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { LIMITS, PUBLIC_SPACE } from "./lib/constants";
import { createDepartmentWithChannel, listActiveDepartments, slugify } from "./lib/departments";
import { appError } from "./lib/errors";
import { trackLeadership } from "./lib/groups";
import { archivePhrase } from "./lib/text";
import { requireAdmin, requireViewer } from "./lib/permissions";

function cleanDepartmentName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > LIMITS.departmentName) throw appError("INVALID", "name");
  return trimmed;
}

/** Available to any signed-in user (needed by the onboarding form). */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    const departments = await listActiveDepartments(ctx);
    return departments.map((d) => ({
      _id: d._id,
      slug: d.slug,
      nameZh: d.nameZh,
      nameEn: d.nameEn,
      kind: d.kind,
    }));
  },
});

export const create = mutation({
  args: { nameZh: v.string(), nameEn: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const nameZh = cleanDepartmentName(args.nameZh);
    const nameEn = cleanDepartmentName(args.nameEn);

    const base = slugify(nameEn);
    let slug = base;
    for (let i = 2; ; i++) {
      const taken = await ctx.db
        .query("departments")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!taken && slug !== PUBLIC_SPACE) break;
      slug = `${base}-${i}`;
    }

    const all = await ctx.db.query("departments").collect();
    const sortOrder = all.reduce((max, d) => Math.max(max, d.sortOrder), -1) + 1;
    const departmentId = await createDepartmentWithChannel(ctx, {
      slug,
      nameZh,
      nameEn,
      kind: "regular",
      sortOrder,
    });
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "department.create",
      targetType: "department",
      targetId: departmentId,
      metadata: { nameZh, nameEn },
    });
    return departmentId;
  },
});

export const update = mutation({
  args: { departmentId: v.id("departments"), nameZh: v.string(), nameEn: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const department = await ctx.db.get("departments", args.departmentId);
    if (!department) throw appError("NOT_FOUND");
    const nameZh = cleanDepartmentName(args.nameZh);
    const nameEn = cleanDepartmentName(args.nameEn);
    await ctx.db.patch("departments", department._id, { nameZh, nameEn });
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "department.update",
      targetType: "department",
      targetId: department._id,
      metadata: { nameZh, nameEn },
    });
  },
});

/**
 * Archiving makes the department's channels read-only and stops its 部长 permissions;
 * 主席团 take over its group chats. Memberships are kept so it can be undone.
 */
export const archive = mutation({
  args: { departmentId: v.id("departments"), phrase: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const department = await ctx.db.get("departments", args.departmentId);
    if (!department || department.archivedAt) throw appError("NOT_FOUND");
    if (department.kind === "presidium") throw appError("FORBIDDEN");
    if (args.phrase.trim() !== archivePhrase(department.nameZh)) throw appError("INVALID", "phrase");
    await trackLeadership(ctx, [department._id], viewer.user._id, () =>
      ctx.db.patch("departments", department._id, { archivedAt: Date.now() }),
    );
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "department.archive",
      targetType: "department",
      targetId: department._id,
    });
  },
});

export const unarchive = mutation({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const department = await ctx.db.get("departments", args.departmentId);
    if (!department || !department.archivedAt) throw appError("NOT_FOUND");
    await trackLeadership(ctx, [department._id], viewer.user._id, () =>
      ctx.db.patch("departments", department._id, { archivedAt: undefined }),
    );
    await logAudit(ctx, {
      actorId: viewer.user._id,
      action: "department.unarchive",
      targetType: "department",
      targetId: department._id,
    });
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const departments = await ctx.db.query("departments").collect();
    const archived = departments.filter((d) => d.archivedAt !== undefined);
    return Promise.all(
      archived.map(async (d) => ({
        _id: d._id,
        nameZh: d.nameZh,
        nameEn: d.nameEn,
        archivedAt: d.archivedAt!,
        memberCount: (
          await ctx.db
            .query("departmentMemberships")
            .withIndex("by_department", (q) => q.eq("departmentId", d._id))
            .collect()
        ).length,
      })),
    );
  },
});

export const reorder = mutation({
  args: { departmentIds: v.array(v.id("departments")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    for (const [index, departmentId] of args.departmentIds.entries()) {
      const department = await ctx.db.get("departments", departmentId);
      if (department) await ctx.db.patch("departments", departmentId, { sortOrder: index });
    }
  },
});
