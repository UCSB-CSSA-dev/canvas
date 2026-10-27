import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./errors";
import { requireApproved } from "./permissions";
import { taskAccess } from "./tasks";

export const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

export const EMPTY_DOC = { type: "doc", content: [] };

/**
 * Anyone who can see the task can read its documents. Reviewers and assignees (or event helpers)
 * can edit them until the task is closed.
 */
export async function documentAccess(ctx: QueryCtx, id: string) {
  const viewer = await requireApproved(ctx);
  const documentId = ctx.db.normalizeId("documents", id);
  const doc = documentId ? await ctx.db.get("documents", documentId) : null;
  if (!doc) throw appError("NOT_FOUND");
  const assignment = await ctx.db.get("assignments", doc.assignmentId);
  if (!assignment) throw appError("NOT_FOUND");
  const access = await taskAccess(ctx, viewer, assignment);
  if (!access) throw appError("NOT_FOUND");
  const canEdit = assignment.status !== "closed" && (access.review || access.submission !== null);
  const canDelete = canEdit && (access.review || doc.createdBy === viewer.user._id);
  return { viewer, doc, assignment, access, canEdit, canDelete };
}

/** Deletes a task's documents and their content (draft deletion). */
export async function deleteTaskDocuments(ctx: MutationCtx, assignmentId: Id<"assignments">) {
  const docs = await ctx.db
    .query("documents")
    .withIndex("by_assignment", (q) => q.eq("assignmentId", assignmentId))
    .collect();
  for (const doc of docs) {
    await ctx.db.delete("documents", doc._id);
    await ctx.runMutation(components.prosemirrorSync.lib.deleteDocument, { id: doc._id });
  }
}
