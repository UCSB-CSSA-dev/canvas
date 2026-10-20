import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { activeLeadIds, groupDepartmentIds, isTakenOver, presidiumUserIds } from "./channels";
import { postSystemMessage } from "./messages";
import { chatLink, notifyMany } from "./notify";
import { isLeadOf, type ViewerContext } from "./permissions";

export function canReviewProposal(viewer: ViewerContext, proposal: Doc<"groupProposals">) {
  return viewer.isAdmin || proposal.departmentIds.some((id) => isLeadOf(viewer, id));
}

/** Pending proposals the viewer can approve; nobody approves their own unless they're an admin. */
export async function reviewableProposals(ctx: QueryCtx, viewer: ViewerContext) {
  if (!viewer.isAdmin && viewer.ledDepartmentIds.length === 0) return [];
  const pending = await ctx.db
    .query("groupProposals")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .collect();
  return pending.filter(
    (p) => canReviewProposal(viewer, p) && (p.proposerId !== viewer.user._id || viewer.isAdmin),
  );
}

/** Pending proposals are cancelled when their proposer is deactivated. */
export async function cancelProposalsOf(ctx: MutationCtx, userId: Id<"users">) {
  const proposals = await ctx.db
    .query("groupProposals")
    .withIndex("by_proposer", (q) => q.eq("proposerId", userId))
    .collect();
  for (const proposal of proposals) {
    if (proposal.status === "pending") {
      await ctx.db.patch("groupProposals", proposal._id, { status: "cancelled" });
    }
  }
}

async function hasLeads(ctx: MutationCtx, departmentId: Id<"departments">) {
  return (await activeLeadIds(ctx, departmentId)).length > 0;
}

/**
 * Runs `change` and then announces 主席团 takeovers in the department's group chats:
 * when a department loses its last 部长 (or is archived) 主席团 take over its groups,
 * and when it gets one back they hand over.
 */
export async function trackLeadership<T>(
  ctx: MutationCtx,
  departmentIds: Id<"departments">[],
  actorId: Id<"users">,
  change: () => Promise<T>,
): Promise<T> {
  const unique = [...new Set(departmentIds)];
  const before = new Map<Id<"departments">, boolean>();
  for (const id of unique) before.set(id, await hasLeads(ctx, id));
  const result = await change();
  for (const id of unique) {
    const now = await hasLeads(ctx, id);
    if (before.get(id) !== now) await leadershipChanged(ctx, id, now, actorId);
  }
  return result;
}

async function leadershipChanged(
  ctx: MutationCtx,
  departmentId: Id<"departments">,
  hasLeadsNow: boolean,
  actorId: Id<"users">,
) {
  const rows = await ctx.db
    .query("groupDepartments")
    .withIndex("by_department", (q) => q.eq("departmentId", departmentId))
    .collect();
  const takenOver: { id: Id<"channels">; name: string }[] = [];
  for (const row of rows) {
    const group = await ctx.db.get("channels", row.channelId);
    if (!group || group.endedAt) continue;
    if (!hasLeadsNow) {
      await postSystemMessage(ctx, {
        channelId: group._id,
        actorId,
        event: "takeover_started",
        params: { departmentId },
      });
      takenOver.push({ id: group._id, name: group.name ?? "" });
    } else if (!(await isTakenOver(ctx, await groupDepartmentIds(ctx, group._id)))) {
      await postSystemMessage(ctx, {
        channelId: group._id,
        actorId,
        event: "takeover_ended",
        params: { departmentId },
      });
    }
  }
  if (takenOver.length > 0) {
    await notifyMany(ctx, await presidiumUserIds(ctx), {
      type: "group_takeover",
      params: { departmentId, groupNames: takenOver.map((g) => g.name), count: takenOver.length },
      link: chatLink(takenOver[0].id),
    });
  }
}
