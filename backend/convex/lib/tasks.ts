import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { channelAccess, groupDepartmentIds } from "./channels";
import { isLeadOf, type ViewerContext } from "./permissions";
import { endOfPacificDay } from "./time";

export function taskLink(assignmentId: Id<"assignments">) {
  return `/assignments/view/?a=${assignmentId}`;
}

/**
 * Whether the viewer creates and manages tasks in this chat: 主席团 in 全体, the department's 部长 and
 * 主席团 in a department chat, 部长 of an involved department and 主席团 members in a group.
 */
export async function managesTaskChannel(
  ctx: QueryCtx,
  viewer: ViewerContext,
  channel: Doc<"channels">,
  opts: { requireWritable: boolean },
) {
  if (channel.type !== "org" && channel.type !== "department" && channel.type !== "group") return false;
  const access = await channelAccess(ctx, viewer, channel);
  if (access.via !== "member") return false;
  if (opts.requireWritable && access.readOnly) return false;
  if (channel.type === "org") return viewer.isAdmin;
  if (channel.type === "department") {
    return viewer.isAdmin || (channel.departmentId !== undefined && isLeadOf(viewer, channel.departmentId));
  }
  const departmentIds = await groupDepartmentIds(ctx, channel._id);
  return viewer.isAdmin || departmentIds.some((id) => viewer.ledDepartmentIds.includes(id));
}

export function canCreateTaskIn(ctx: QueryCtx, viewer: ViewerContext, channel: Doc<"channels">) {
  return managesTaskChannel(ctx, viewer, channel, { requireWritable: true });
}

/**
 * File spaces a task in this chat can use: 公共 for 全体, the department, or a group's departments
 * the viewer manages (公共 when there are none, e.g. an admin in a group without departments).
 */
export async function taskSpaceOptions(
  ctx: QueryCtx,
  viewer: ViewerContext,
  channel: Doc<"channels">,
): Promise<(Id<"departments"> | undefined)[]> {
  if (channel.type === "org") return [undefined];
  if (channel.type === "department") return channel.departmentId ? [channel.departmentId] : [];
  if (channel.type !== "group") return [];
  const options: Id<"departments">[] = [];
  for (const departmentId of await groupDepartmentIds(ctx, channel._id)) {
    const department = await ctx.db.get("departments", departmentId);
    if (!department || department.archivedAt) continue;
    if (viewer.isAdmin || isLeadOf(viewer, departmentId)) options.push(departmentId);
  }
  return options.length > 0 ? options : [undefined];
}

export type TaskAccess = {
  view: boolean;
  /** Creator, 主席团, and whoever manages tasks in the task's chat. */
  review: boolean;
  isCreator: boolean;
  submission: Doc<"assignmentSubmissions"> | null;
  channel: Doc<"channels"> | null;
};

export async function mySubmission(ctx: QueryCtx, assignmentId: Id<"assignments">, userId: Id<"users">) {
  return ctx.db
    .query("assignmentSubmissions")
    .withIndex("by_assignment_assignee", (q) => q.eq("assignmentId", assignmentId).eq("assigneeId", userId))
    .unique();
}

/** What the viewer can do with a task, or null when they can't see it. */
export async function taskAccess(
  ctx: QueryCtx,
  viewer: ViewerContext,
  assignment: Doc<"assignments">,
): Promise<TaskAccess | null> {
  const isCreator = assignment.createdBy === viewer.user._id;
  const channel = await ctx.db.get("channels", assignment.channelId);
  if (assignment.status === "draft") {
    return isCreator ? { view: true, review: true, isCreator, submission: null, channel } : null;
  }
  const submission = await mySubmission(ctx, assignment._id, viewer.user._id);
  const review =
    isCreator ||
    viewer.isAdmin ||
    (channel !== null && (await managesTaskChannel(ctx, viewer, channel, { requireWritable: false })));
  let view = review || submission !== null;
  if (!view && channel) view = (await channelAccess(ctx, viewer, channel)).via === "member";
  return view ? { view, review, isCreator, submission, channel } : null;
}

/** Events are over at their end time, or at the end of the start day when there is none. */
export function eventEnd(assignment: Pick<Doc<"assignments">, "startAt" | "endAt">) {
  if (assignment.endAt) return assignment.endAt;
  return assignment.startAt ? endOfPacificDay(assignment.startAt) : 0;
}

/** Still something the assignee has to do. */
export function isOpenForAssignee(assignment: Doc<"assignments">, submission: Doc<"assignmentSubmissions">, now: number) {
  if (assignment.status !== "open") return false;
  if (assignment.kind === "event") return eventEnd(assignment) > now;
  return submission.status === "assigned" || submission.status === "changes_requested";
}
