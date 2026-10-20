import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { LIMITS } from "./lib/constants";
import { appError } from "./lib/errors";
import { deleteAttachmentFiles } from "./lib/messages";
import { requireApproved } from "./lib/permissions";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireApproved(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Records an upload before it's sent. Sizes and types come from `_storage`, not the client.
 * Oversized files are deleted. Unsent uploads expire after LIMITS.unsentUploadHours.
 */
export const register = mutation({
  args: {
    storageId: v.id("_storage"),
    thumbStorageId: v.optional(v.id("_storage")),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const file = await ctx.db.system.get("_storage", args.storageId);
    if (!file) throw appError("NOT_FOUND");
    const thumb = args.thumbStorageId ? await ctx.db.system.get("_storage", args.thumbStorageId) : null;

    const discard = async () => {
      await ctx.storage.delete(args.storageId);
      if (args.thumbStorageId && thumb) await ctx.storage.delete(args.thumbStorageId);
    };
    if (file.size > LIMITS.attachmentBytes) {
      await discard();
      throw appError("FILE_TOO_LARGE");
    }
    if (thumb && (thumb.size > LIMITS.thumbnailBytes || !thumb.contentType?.startsWith("image/"))) {
      await discard();
      throw appError("INVALID", "thumbnail");
    }
    const name = args.name.trim().slice(0, LIMITS.attachmentName) || "file";

    return await ctx.db.insert("attachments", {
      storageId: args.storageId,
      thumbStorageId: thumb ? args.thumbStorageId : undefined,
      name,
      size: file.size,
      contentType: file.contentType ?? "application/octet-stream",
      uploaderId: viewer.user._id,
      expiresAt: Date.now() + LIMITS.unsentUploadHours * 60 * 60 * 1000,
    });
  },
});

/** Removes an upload the user took back out of the composer. */
export const discard = mutation({
  args: { attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const viewer = await requireApproved(ctx);
    const attachment = await ctx.db.get("attachments", args.attachmentId);
    if (!attachment || attachment.uploaderId !== viewer.user._id || attachment.messageId) {
      throw appError("NOT_FOUND");
    }
    await deleteAttachmentFiles(ctx, attachment);
    await ctx.db.delete("attachments", attachment._id);
  },
});

/** Hourly: delete expired files. Sent attachments keep their row as a "file expired" card. */
export const expire = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("attachments")
      .withIndex("by_expiry", (q) => q.eq("expiredAt", undefined).lt("expiresAt", now))
      .take(LIMITS.purgeBatch);
    for (const attachment of due) {
      await deleteAttachmentFiles(ctx, attachment);
      if (attachment.messageId) {
        await ctx.db.patch("attachments", attachment._id, { expiredAt: now });
      } else {
        await ctx.db.delete("attachments", attachment._id);
      }
    }
    if (due.length === LIMITS.purgeBatch) {
      await ctx.scheduler.runAfter(0, internal.attachments.expire, {});
    }
  },
});
