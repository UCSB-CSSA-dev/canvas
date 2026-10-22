import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { messageState, type MessageState } from "./messages";
import { MENTION_PATTERN } from "./text";
import { getUserSummaries, type UserSummary } from "./users";

export type AttachmentView = {
  _id: Id<"attachments">;
  name: string;
  size: number;
  contentType: string;
  isImage: boolean;
  url: string | null;
  thumbUrl: string | null;
  expired: boolean;
};

export type ForwardItem = {
  authorId: Id<"users">;
  body: string;
  sentAt: number;
  attachmentIds: Id<"attachments">[];
  forward?: ForwardSnapshot;
};

export type ForwardSnapshot = {
  source: {
    type: Doc<"channels">["type"];
    nameZh?: string;
    nameEn?: string;
    name?: string;
    /** DMs: the two people, to title the record "A 和 B 的聊天记录". */
    userIds?: Id<"users">[];
  };
  items: ForwardItem[];
};

export type ForwardItemView = Omit<ForwardItem, "forward"> & {
  attachments: AttachmentView[];
  forward?: ForwardView;
};
export type ForwardView = { source: ForwardSnapshot["source"]; items: ForwardItemView[] };

export type ReactionView = { emoji: string; count: number; mine: boolean; userIds: Id<"users">[] };

export type ReplyView = {
  _id: Id<"messages">;
  authorId: Id<"users"> | null;
  body: string;
  state: MessageState | "missing";
};

export type MessageView = {
  _id: Id<"messages">;
  _creationTime: number;
  kind: "user" | "system" | "forward";
  authorId: Id<"users">;
  body: string;
  state: MessageState;
  announcement: boolean;
  editedAt?: number;
  removedBy?: Id<"users">;
  replyTo?: ReplyView;
  reactions: ReactionView[];
  attachments: AttachmentView[];
  system?: { event: string; params: Record<string, unknown> };
  forward?: ForwardView;
  /** Every user referenced by this message (author, mentions, reactions, system params, forwards). */
  people: UserSummary[];
  /** Departments referenced by system params. */
  departments: DepartmentName[];
};

export type DepartmentName = { _id: Id<"departments">; nameZh: string; nameEn: string };

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);

async function attachmentViews(ctx: QueryCtx, rows: (Doc<"attachments"> | null)[]) {
  const views: AttachmentView[] = [];
  for (const row of rows) {
    if (!row) continue;
    const expired = row.expiredAt !== undefined;
    views.push({
      _id: row._id,
      name: row.name,
      size: row.size,
      contentType: row.contentType,
      isImage: IMAGE_TYPES.has(row.contentType),
      url: expired ? null : await ctx.storage.getUrl(row.storageId),
      thumbUrl: expired || !row.thumbStorageId ? null : await ctx.storage.getUrl(row.thumbStorageId),
      expired,
    });
  }
  return views;
}

function mentionIds(body: string) {
  return [...body.matchAll(MENTION_PATTERN)].map((m) => m[1]).filter((id) => id !== "all");
}

async function forwardView(
  ctx: QueryCtx,
  snapshot: ForwardSnapshot,
  people: Set<string>,
): Promise<ForwardView> {
  for (const id of snapshot.source.userIds ?? []) people.add(id);
  const items: ForwardItemView[] = [];
  for (const item of snapshot.items) {
    people.add(item.authorId);
    for (const id of mentionIds(item.body)) people.add(id);
    const rows = await Promise.all(item.attachmentIds.map((id) => ctx.db.get("attachments", id)));
    items.push({
      authorId: item.authorId,
      body: item.body,
      sentAt: item.sentAt,
      attachmentIds: item.attachmentIds,
      attachments: await attachmentViews(ctx, rows),
      forward: item.forward ? await forwardView(ctx, item.forward, people) : undefined,
    });
  }
  return { source: snapshot.source, items };
}

export async function toMessageViews(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  messages: Doc<"messages">[],
): Promise<MessageView[]> {
  const views: MessageView[] = [];
  for (const message of messages) {
    const people = new Set<string>([message.authorId]);
    const state = messageState(message);
    if (message.removedBy) people.add(message.removedBy);
    for (const id of mentionIds(message.body)) people.add(id);

    const reactionRows = await ctx.db
      .query("messageReactions")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .collect();
    const byEmoji = new Map<string, Id<"users">[]>();
    for (const row of reactionRows) {
      byEmoji.set(row.emoji, [...(byEmoji.get(row.emoji) ?? []), row.userId]);
      people.add(row.userId);
    }
    const reactions = [...byEmoji.entries()].map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      mine: userIds.includes(viewerId),
      userIds,
    }));

    let replyTo: ReplyView | undefined;
    if (message.replyToId) {
      const original = await ctx.db.get("messages", message.replyToId);
      if (original) people.add(original.authorId);
      for (const id of original ? mentionIds(original.body) : []) people.add(id);
      replyTo = original
        ? {
            _id: original._id,
            authorId: original.authorId,
            body: messageState(original) === "normal" ? original.body.slice(0, 200) : "",
            state: messageState(original),
          }
        : { _id: message.replyToId, authorId: null, body: "", state: "missing" };
    }

    const attachmentRows = await ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .collect();

    const system = message.system
      ? { event: message.system.event, params: (message.system.params ?? {}) as Record<string, unknown> }
      : undefined;
    const departments: DepartmentName[] = [];
    for (const value of Object.values(system?.params ?? {})) {
      for (const id of Array.isArray(value) ? value : [value]) {
        if (typeof id !== "string") continue;
        if (ctx.db.normalizeId("users", id)) people.add(id);
        const departmentId = ctx.db.normalizeId("departments", id);
        const department = departmentId ? await ctx.db.get("departments", departmentId) : null;
        if (department) departments.push({ _id: department._id, nameZh: department.nameZh, nameEn: department.nameEn });
      }
    }

    const forward =
      message.forward && state === "normal"
        ? await forwardView(ctx, message.forward as ForwardSnapshot, people)
        : undefined;

    const summaries = await getUserSummaries(
      ctx,
      [...people].flatMap((id) => {
        const userId = ctx.db.normalizeId("users", id);
        return userId ? [userId] : [];
      }),
    );

    views.push({
      _id: message._id,
      _creationTime: message._creationTime,
      kind: message.kind ?? "user",
      authorId: message.authorId,
      body: state === "normal" ? message.body : "",
      state,
      announcement: message.announcement === true,
      editedAt: message.editedAt,
      removedBy: message.removedBy,
      replyTo,
      reactions,
      attachments: await attachmentViews(ctx, attachmentRows),
      system,
      forward,
      people: [...summaries.values()],
      departments,
    });
  }
  return views;
}
