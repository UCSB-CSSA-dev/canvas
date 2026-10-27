import { v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { LIMITS } from "./lib/constants";
import { documentAccess, EMPTY_DOC, prosemirrorSync } from "./lib/documents";
import { appError } from "./lib/errors";
import { requireApproved } from "./lib/permissions";
import { taskAccess } from "./lib/tasks";
import { getUserSummaries } from "./lib/users";

function cleanTitle(title: string) {
  const cleaned = title.replace(/\s+/g, " ").trim().slice(0, LIMITS.documentTitle);
  if (!cleaned) throw appError("INVALID", "title");
  return cleaned;
}

/** A task's documents, newest edit first, and whether the viewer can add one. */
export const listForTask = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const assignment = await ctx.db.get("assignments", args.assignmentId);
    if (!assignment) return null;
    const access = await taskAccess(ctx, viewer, assignment);
    if (!access) return null;
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
      .collect();
    const people = await getUserSummaries(
      ctx,
      docs.map((d) => d.updatedBy),
    );
    const canEdit = assignment.status !== "closed" && (access.review || access.submission !== null);
    return {
      canCreate: canEdit && docs.length < LIMITS.documentsPerTask,
      documents: docs
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((d) => ({
          _id: d._id,
          title: d.title,
          updatedAt: d.updatedAt,
          updatedBy: people.get(d.updatedBy) ?? null,
        })),
    };
  },
});

/** One document's details for the editor page, or null when it's gone or hidden. */
export const get = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    let found;
    try {
      found = await documentAccess(ctx, args.documentId);
    } catch {
      return null;
    }
    const { doc, assignment, canEdit, canDelete } = found;
    const people = await getUserSummaries(ctx, [doc.updatedBy, doc.createdBy]);
    return {
      _id: doc._id,
      title: doc.title,
      updatedAt: doc.updatedAt,
      updatedBy: people.get(doc.updatedBy) ?? null,
      createdBy: people.get(doc.createdBy) ?? null,
      assignment: { _id: assignment._id, title: assignment.title, kind: assignment.kind, status: assignment.status },
      canEdit,
      canDelete,
    };
  },
});

export const create = mutation({
  args: { assignmentId: v.id("assignments"), title: v.string() },
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const viewer = await requireApproved(ctx);
    const assignment = await ctx.db.get("assignments", args.assignmentId);
    if (!assignment) throw appError("NOT_FOUND");
    const access = await taskAccess(ctx, viewer, assignment);
    if (!access) throw appError("NOT_FOUND");
    if (assignment.status === "closed" || (!access.review && !access.submission)) throw appError("FORBIDDEN");
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
      .collect();
    if (existing.length >= LIMITS.documentsPerTask) throw appError("INVALID", "tooMany");
    const now = Date.now();
    const documentId = await ctx.db.insert("documents", {
      assignmentId: assignment._id,
      title: cleanTitle(args.title),
      createdBy: viewer.user._id,
      updatedAt: now,
      updatedBy: viewer.user._id,
    });
    await prosemirrorSync.create(ctx, documentId, EMPTY_DOC);
    return documentId;
  },
});

export const rename = mutation({
  args: { documentId: v.id("documents"), title: v.string() },
  handler: async (ctx, args) => {
    const { doc, canEdit } = await documentAccess(ctx, args.documentId);
    if (!canEdit) throw appError("FORBIDDEN");
    await ctx.db.patch("documents", doc._id, { title: cleanTitle(args.title) });
  },
});

export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const { doc, canDelete } = await documentAccess(ctx, args.documentId);
    if (!canDelete) throw appError("FORBIDDEN");
    await ctx.db.delete("documents", doc._id);
    await ctx.runMutation(components.prosemirrorSync.lib.deleteDocument, { id: doc._id });
  },
});
