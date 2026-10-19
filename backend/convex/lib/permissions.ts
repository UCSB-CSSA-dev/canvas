import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { MembershipRole } from "./types";
import { appError } from "./errors";

export type ViewerContext = {
  user: Doc<"users">;
  memberships: Doc<"departmentMemberships">[];
  isSystemAdmin: boolean;
  isPresidium: boolean;
  /** System admin or presidium. */
  isAdmin: boolean;
  /** Regular departments where the viewer is a lead. */
  ledDepartmentIds: Id<"departments">[];
  /** Every department the viewer belongs to (any role). */
  memberDepartmentIds: Id<"departments">[];
};

export async function buildViewerContext(
  ctx: QueryCtx,
  user: Doc<"users">,
): Promise<ViewerContext> {
  const memberships = await ctx.db
    .query("departmentMemberships")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  const departments = await Promise.all(
    memberships.map((m) => ctx.db.get("departments", m.departmentId)),
  );

  let isPresidium = false;
  const ledDepartmentIds: Id<"departments">[] = [];
  const memberDepartmentIds: Id<"departments">[] = [];
  memberships.forEach((membership, i) => {
    const department = departments[i];
    if (!department || department.archivedAt) return;
    memberDepartmentIds.push(department._id);
    if (department.kind === "presidium") isPresidium = true;
    else if (membership.role === "lead") ledDepartmentIds.push(department._id);
  });

  const isSystemAdmin = user.isSystemAdmin === true;
  return {
    user,
    memberships,
    isSystemAdmin,
    isPresidium,
    isAdmin: isSystemAdmin || isPresidium,
    ledDepartmentIds,
    memberDepartmentIds,
  };
}

export async function getViewer(ctx: QueryCtx): Promise<ViewerContext | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get("users", userId);
  if (!user) return null;
  return buildViewerContext(ctx, user);
}

export async function requireViewer(ctx: QueryCtx): Promise<ViewerContext> {
  const viewer = await getViewer(ctx);
  if (!viewer) throw appError("UNAUTHENTICATED");
  return viewer;
}

export async function requireApproved(ctx: QueryCtx): Promise<ViewerContext> {
  const viewer = await requireViewer(ctx);
  if (viewer.user.status !== "approved") throw appError("NOT_APPROVED");
  return viewer;
}

export async function requireAdmin(ctx: QueryCtx): Promise<ViewerContext> {
  const viewer = await requireApproved(ctx);
  if (!viewer.isAdmin) throw appError("FORBIDDEN");
  return viewer;
}

export async function requireSystemAdmin(ctx: QueryCtx): Promise<ViewerContext> {
  const viewer = await requireApproved(ctx);
  if (!viewer.isSystemAdmin) throw appError("FORBIDDEN");
  return viewer;
}

export function isLeadOf(viewer: ViewerContext, departmentId: Id<"departments">) {
  return viewer.ledDepartmentIds.includes(departmentId);
}

/** Add or remove members (role "member") of a department. */
export function canManageDepartmentMembers(
  viewer: ViewerContext,
  departmentId: Id<"departments">,
) {
  return viewer.isAdmin || isLeadOf(viewer, departmentId);
}

export function canPreApprove(
  viewer: ViewerContext,
  department: Doc<"departments">,
  role: MembershipRole,
) {
  if (viewer.isAdmin) return true;
  return (
    department.kind === "regular" && role === "member" && isLeadOf(viewer, department._id)
  );
}

export async function canReadChannel(
  ctx: QueryCtx,
  viewer: ViewerContext,
  channel: Doc<"channels">,
): Promise<boolean> {
  switch (channel.type) {
    case "org":
      return true;
    case "department":
      return (
        channel.departmentId !== undefined &&
        (viewer.isAdmin || viewer.memberDepartmentIds.includes(channel.departmentId))
      );
    case "dm": {
      const row = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", channel._id).eq("userId", viewer.user._id),
        )
        .unique();
      return row !== null;
    }
  }
}

/** In Stage 1 everyone who can read a channel can post in it. */
export async function canPostInChannel(
  ctx: QueryCtx,
  viewer: ViewerContext,
  channel: Doc<"channels">,
): Promise<boolean> {
  return canReadChannel(ctx, viewer, channel);
}
