import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { foldText } from "./text";

export type MessageState = "normal" | "recalled" | "removed";

export function messageState(message: Doc<"messages">): MessageState {
  if (message.removedAt) return "removed";
  if (message.recalledAt) return "recalled";
  return "normal";
}

/** Counts toward unread and can be reacted to, replied to, and forwarded. */
export function isLiveUserContent(message: Doc<"messages">) {
  return (message.kind ?? "user") !== "system" && messageState(message) === "normal";
}

/** Posts a translated system line ("Alice 将 Bob 加入了群聊"). */
export async function postSystemMessage(
  ctx: MutationCtx,
  args: {
    channelId: Id<"channels">;
    actorId: Id<"users">;
    event: string;
    params?: Record<string, unknown>;
  },
) {
  await ctx.db.insert("messages", {
    channelId: args.channelId,
    authorId: args.actorId,
    body: "",
    kind: "system",
    system: { event: args.event, params: args.params ?? {} },
  });
  await ctx.db.patch("channels", args.channelId, { lastMessageAt: Date.now() });
}

export async function deleteAttachmentFiles(ctx: MutationCtx, attachment: Doc<"attachments">) {
  if (attachment.expiredAt) return;
  // Saved to Files: the file row now owns the stored object (and its thumbnail).
  const savedCopy = await ctx.db
    .query("files")
    .withIndex("by_storage", (q) => q.eq("storageId", attachment.storageId))
    .first();
  if (savedCopy) return;
  await ctx.storage.delete(attachment.storageId);
  if (attachment.thumbStorageId) await ctx.storage.delete(attachment.thumbStorageId);
}

/** Removes everything attached to a message (recall, moderation, purge). */
async function deleteMessageExtras(ctx: MutationCtx, messageId: Id<"messages">) {
  for (const table of ["messageReactions", "messageEdits"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect();
    for (const row of rows) await ctx.db.delete(table, row._id);
  }
  const attachments = await ctx.db
    .query("attachments")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .collect();
  for (const attachment of attachments) {
    await deleteAttachmentFiles(ctx, attachment);
    await ctx.db.delete("attachments", attachment._id);
  }
}

/** Recall and moderation: erase the content but keep the row as a placeholder. */
export async function eraseMessageContent(ctx: MutationCtx, message: Doc<"messages">) {
  await deleteMessageExtras(ctx, message._id);
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_message", (q) => q.eq("messageId", message._id))
    .collect();
  for (const row of notifications) await ctx.db.delete("notifications", row._id);
  await ctx.db.patch("messages", message._id, {
    body: "",
    mentionUserIds: [],
    mentionAll: false,
    searchText: "",
    forward: undefined,
    fileIds: undefined,
  });
}

/** Retention purge: delete the message entirely. */
export async function deleteMessage(ctx: MutationCtx, message: Doc<"messages">) {
  await deleteMessageExtras(ctx, message._id);
  await ctx.db.delete("messages", message._id);
}

/** One-line preview for notifications and reply quotes, with mention tokens shown as names. */
export function previewText(body: string, names: Map<string, string>, max = 80) {
  const text = body
    .replace(/<@([a-z0-9]+)>/gi, (_, id: string) => `@${id === "all" ? "所有人" : (names.get(id) ?? "")}`)
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function mentionNames(ctx: QueryCtx, body: string) {
  const ids = [...body.matchAll(/<@([a-z0-9]+)>/gi)].map((m) => m[1]).filter((id) => id !== "all");
  const names = new Map<string, string>();
  for (const id of ids) {
    const userId = ctx.db.normalizeId("users", id);
    const user = userId ? await ctx.db.get("users", userId) : null;
    if (user) names.set(id, user.nameZh || user.nameEn || user.name || user.email || "");
  }
  return names;
}

export function matchesQuery(body: string, query: string) {
  const needle = foldText(query).trim();
  return needle !== "" && foldText(body).includes(needle);
}
