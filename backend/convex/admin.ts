import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { appError } from "./lib/errors";
import { reviewableProposals } from "./lib/groups";
import { requireAdmin, requireApproved } from "./lib/permissions";
import { getUserSummaries, type UserSummary } from "./lib/users";

/** Admins see org-wide counts; 部长 see their own departments. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireApproved(ctx);
    if (!viewer.isAdmin && viewer.ledDepartmentIds.length === 0) throw appError("FORBIDDEN");
    const inScope = (departmentId: Id<"departments">) =>
      viewer.isAdmin || viewer.ledDepartmentIds.includes(departmentId);

    const pendingUsers = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const pendingApprovals = viewer.isAdmin
      ? pendingUsers.length
      : pendingUsers.filter((u) => (u.requestedDepartmentIds ?? []).some(inScope)).length;

    const preApprovals = (await ctx.db.query("preApprovals").collect()).filter(
      (p) => !p.claimedAt && !p.revokedAt && inScope(p.departmentId),
    ).length;

    const pendingDeactivations = viewer.isAdmin
      ? (
          await ctx.db
            .query("deactivationRequests")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect()
        ).length
      : null;

    const approved = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const approvedIds = new Set(approved.map((u) => u._id));

    const departments = (await ctx.db.query("departments").collect())
      .filter((d) => !d.archivedAt && inScope(d._id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const assigned = new Set<Id<"users">>();
    const perDepartment = [];
    for (const department of departments) {
      const rows = (
        await ctx.db
          .query("departmentMemberships")
          .withIndex("by_department", (q) => q.eq("departmentId", department._id))
          .collect()
      ).filter((m) => approvedIds.has(m.userId));
      for (const row of rows) assigned.add(row.userId);
      perDepartment.push({
        departmentId: department._id,
        nameZh: department.nameZh,
        nameEn: department.nameEn,
        kind: department.kind,
        leads: rows.filter((m) => m.role === "lead").length,
        members: rows.filter((m) => m.role === "member").length,
      });
    }

    let storage: { bytes: number; files: number } | null = null;
    let unassigned: number | null = null;
    if (viewer.isAdmin) {
      const files = await ctx.db.system.query("_storage").collect();
      storage = { bytes: files.reduce((sum, f) => sum + f.size, 0), files: files.length };
      const anyMembership = new Set(
        (await ctx.db.query("departmentMemberships").collect())
          .filter((m) => departments.some((d) => d._id === m.departmentId))
          .map((m) => m.userId),
      );
      unassigned = approved.filter((u) => !anyMembership.has(u._id)).length;
    }

    return {
      scope: viewer.isAdmin ? ("org" as const) : ("departments" as const),
      pendingApprovals,
      preApprovals,
      pendingDeactivations,
      pendingGroups: (await reviewableProposals(ctx, viewer)).length,
      activeMembers: viewer.isAdmin ? approved.length : assigned.size,
      unassigned,
      perDepartment,
      storage,
    };
  },
});

export type AuditEntryView = {
  _id: Id<"auditLogs">;
  _creationTime: number;
  action: string;
  targetType: string;
  targetId: string;
  actorId?: Id<"users">;
  subjectUserId?: Id<"users">;
  metadata?: Record<string, unknown>;
  people: UserSummary[];
};

export const auditLog = query({
  args: {
    paginationOpts: paginationOptsValidator,
    actorId: v.optional(v.id("users")),
    subjectUserId: v.optional(v.id("users")),
    action: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const from = args.from ?? 0;
    const to = args.to ?? Number.MAX_SAFE_INTEGER;
    const table = ctx.db.query("auditLogs");
    const indexed = args.actorId
      ? table.withIndex("by_actor", (q) =>
          q.eq("actorId", args.actorId).gte("_creationTime", from).lte("_creationTime", to),
        )
      : args.subjectUserId
        ? table.withIndex("by_subject", (q) =>
            q.eq("subjectUserId", args.subjectUserId).gte("_creationTime", from).lte("_creationTime", to),
          )
        : args.action
          ? table.withIndex("by_action", (q) =>
              q.eq("action", args.action!).gte("_creationTime", from).lte("_creationTime", to),
            )
          : table.withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lte("_creationTime", to));

    const page = await indexed
      .order("desc")
      .filter((q) =>
        q.and(
          args.subjectUserId ? q.eq(q.field("subjectUserId"), args.subjectUserId) : true,
          args.action ? q.eq(q.field("action"), args.action) : true,
        ),
      )
      .paginate(args.paginationOpts);

    const ids = new Set<Id<"users">>();
    for (const entry of page.page) {
      if (entry.actorId) ids.add(entry.actorId);
      if (entry.subjectUserId) ids.add(entry.subjectUserId);
    }
    const people = await getUserSummaries(ctx, [...ids]);
    return {
      ...page,
      page: page.page.map(
        (entry): AuditEntryView => ({
          _id: entry._id,
          _creationTime: entry._creationTime,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          actorId: entry.actorId,
          subjectUserId: entry.subjectUserId,
          metadata: entry.metadata,
          people: [entry.actorId, entry.subjectUserId].flatMap((id) => (id ? (people.get(id) ?? []) : [])),
        }),
      ),
    };
  },
});
