import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type PublicMember = {
  _id: Id<"users">;
  name?: string;
  nameZh?: string;
  nameEn?: string;
  image?: string;
  bio?: string;
  /** Only when the member chose to show it. */
  email?: string;
  positions: { departmentId: Id<"departments">; role: "lead" | "member" }[];
};

/**
 * Public (no sign-in): the about-us roster. Every approved member with their photo, name, bio and
 * positions; the email only if they opted in. Nothing else about them is exposed.
 */
export const roster = query({
  args: {},
  handler: async (ctx) => {
    const departments = (await ctx.db.query("departments").collect())
      .filter((d) => d.archivedAt === undefined)
      .sort((a, b) => (a.kind === b.kind ? a.sortOrder - b.sortOrder : a.kind === "presidium" ? -1 : 1));
    const active = new Set(departments.map((d) => d._id));

    const users = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const members: PublicMember[] = [];
    for (const user of users) {
      const memberships = await ctx.db
        .query("departmentMemberships")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      members.push({
        _id: user._id,
        name: user.name,
        nameZh: user.nameZh,
        nameEn: user.nameEn,
        image: user.avatarUrl ?? user.image,
        bio: user.bio,
        email: user.showEmailPublicly ? user.email : undefined,
        positions: memberships
          .filter((m) => active.has(m.departmentId))
          .map((m) => ({ departmentId: m.departmentId, role: m.role })),
      });
    }

    return {
      departments: departments.map((d) => ({ _id: d._id, slug: d.slug, nameZh: d.nameZh, nameEn: d.nameEn, kind: d.kind })),
      members,
    };
  },
});
