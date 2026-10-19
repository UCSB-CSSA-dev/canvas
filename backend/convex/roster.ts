import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { listActiveDepartments } from "./lib/departments";
import { requireApproved } from "./lib/permissions";
import type { MembershipRole } from "./lib/types";
import { toUserSummary, type UserSummary } from "./lib/users";

type Person = UserSummary & {
  /** 前主席 ("lead") / 前副主席 ("member"), only for people not currently in 主席团. */
  formerRole?: MembershipRole;
};
type RosterPerson = Person & {
  membershipId: Id<"departmentMemberships">;
  /** 主席团 only: this 副主席 was 主席 earlier in the term. */
  wasChair?: boolean;
};

function byName(a: UserSummary, b: UserSummary) {
  const nameA = a.nameEn ?? a.name ?? a.email ?? "";
  const nameB = b.nameEn ?? b.name ?? b.email ?? "";
  return nameA.localeCompare(nameB);
}

/**
 * The whole hierarchy for every approved user. Pending applicants and unclaimed
 * pre-approvals are only included for admins (all) and leads (their departments).
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireApproved(ctx);
    const departments = await listActiveDepartments(ctx);
    const presidiumIds = new Set(
      departments.filter((d) => d.kind === "presidium").map((d) => d._id),
    );

    const approvedUsers = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const approvedById = new Map(approvedUsers.map((u) => [u._id, u]));
    const memberships = await ctx.db.query("departmentMemberships").collect();
    const inPresidium = new Set(
      memberships.filter((m) => presidiumIds.has(m.departmentId)).map((m) => m.userId),
    );

    // Latest retirement per user; a 前主席 record outranks a later 前副主席 one.
    const formerRoles = new Map<Id<"users">, MembershipRole>();
    for (const row of await ctx.db.query("formerPresidium").collect()) {
      if (inPresidium.has(row.userId) || !approvedById.has(row.userId)) continue;
      if (formerRoles.get(row.userId) !== "lead") formerRoles.set(row.userId, row.role);
    }
    const person = (user: Doc<"users">): Person => ({
      ...toUserSummary(user),
      formerRole: formerRoles.get(user._id),
    });

    const usersInDepartments = new Set<Id<"users">>();
    const roster = departments.map((department) => {
      const leads: RosterPerson[] = [];
      const members: RosterPerson[] = [];
      for (const m of memberships) {
        if (m.departmentId !== department._id) continue;
        const user = approvedById.get(m.userId);
        if (!user) continue;
        usersInDepartments.add(user._id);
        const entry = { ...person(user), membershipId: m._id, wasChair: m.wasChair === true };
        (m.role === "lead" ? leads : members).push(entry);
      }
      return {
        _id: department._id,
        slug: department.slug,
        kind: department.kind,
        nameZh: department.nameZh,
        nameEn: department.nameEn,
        leads: leads.sort(byName),
        members: members.sort(byName),
      };
    });

    const former = approvedUsers
      .filter((u) => formerRoles.has(u._id))
      .map(person)
      .sort(byName);

    const noDepartment = approvedUsers
      .filter((u) => !usersInDepartments.has(u._id) && !formerRoles.has(u._id))
      .map(person)
      .sort(byName);

    const canSeeDepartmentAdmin = (departmentId: Id<"departments">) =>
      viewer.isAdmin || viewer.ledDepartmentIds.includes(departmentId);

    const pendingUsers =
      viewer.isAdmin || viewer.ledDepartmentIds.length > 0
        ? await ctx.db
            .query("users")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect()
        : [];
    const pending = pendingUsers
      .filter(
        (u) => viewer.isAdmin || (u.requestedDepartmentIds ?? []).some(canSeeDepartmentAdmin),
      )
      .map((u) => ({
        ...toUserSummary(u),
        requestedDepartmentIds: u.requestedDepartmentIds ?? [],
        applicationNote: u.applicationNote,
        appliedAt: u._creationTime,
      }));

    const preApprovals =
      viewer.isAdmin || viewer.ledDepartmentIds.length > 0
        ? (await ctx.db.query("preApprovals").collect())
            .filter(
              (p) => !p.claimedAt && !p.revokedAt && canSeeDepartmentAdmin(p.departmentId),
            )
            .map((p) => ({
              _id: p._id,
              email: p.email,
              departmentId: p.departmentId,
              role: p.role,
              note: p.note,
            }))
        : [];

    const deactivated = viewer.isAdmin
      ? (
          await ctx.db
            .query("users")
            .withIndex("by_status", (q) => q.eq("status", "deactivated"))
            .collect()
        )
          .map(toUserSummary)
          .sort(byName)
      : [];

    const deactivationRequests = viewer.isAdmin
      ? (
          await ctx.db
            .query("deactivationRequests")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect()
        ).flatMap((r) => {
          const user = approvedById.get(r.userId);
          return user
            ? [{ _id: r._id, person: person(user), reason: r.reason, requestedAt: r._creationTime }]
            : [];
        })
      : [];

    const viewerPresidium = memberships.find(
      (m) => m.userId === viewer.user._id && presidiumIds.has(m.departmentId),
    );

    return {
      viewer: {
        userId: viewer.user._id,
        isAdmin: viewer.isAdmin,
        isSystemAdmin: viewer.isSystemAdmin,
        isPresidium: viewer.isPresidium,
        isChair: viewerPresidium?.role === "lead",
        ledDepartmentIds: viewer.ledDepartmentIds,
      },
      departments: roster,
      former,
      noDepartment,
      pending,
      deactivationRequests,
      preApprovals,
      deactivated,
    };
  },
});
