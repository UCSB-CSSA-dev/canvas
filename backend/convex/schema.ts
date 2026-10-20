import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { NOTIFICATION_TYPES } from "./lib/constants";

// Stage 1 and 2 tables. See doc/03-data-model.md for the full target schema.

export const userStatus = v.union(
  v.literal("new"),
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("deactivated"),
);

export const membershipRole = v.union(v.literal("lead"), v.literal("member"));

export const locale = v.union(v.literal("zh"), v.literal("en"));

export const channelType = v.union(
  v.literal("org"),
  v.literal("announcement"),
  v.literal("department"),
  v.literal("group"),
  v.literal("dm"),
);

export const notificationType = v.union(
  ...NOTIFICATION_TYPES.map((type) => v.literal(type)),
);

export default defineSchema({
  ...authTables,

  users: defineTable({
    // Managed by Convex Auth
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // App fields
    isSystemAdmin: v.optional(v.boolean()),
    status: v.optional(userStatus),
    nameZh: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    // Public profile. avatarUrl overrides the Google `image`, which Convex Auth rewrites on each sign-in.
    bio: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    avatarUrl: v.optional(v.string()),
    requestedDepartmentIds: v.optional(v.array(v.id("departments"))),
    applicationNote: v.optional(v.string()),
    oversightConsentAt: v.optional(v.number()),
    oversightConsentVersion: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    locale: v.optional(locale),
  })
    .index("email", ["email"])
    .index("by_status", ["status"])
    .index("by_isSystemAdmin", ["isSystemAdmin"]),

  preApprovals: defineTable({
    email: v.string(),
    departmentId: v.id("departments"),
    role: membershipRole,
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    claimedAt: v.optional(v.number()),
    claimedBy: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
    revokedBy: v.optional(v.id("users")),
  })
    .index("by_email", ["email"])
    .index("by_department", ["departmentId"])
    .index("by_email_department", ["email", "departmentId"]),

  departments: defineTable({
    slug: v.string(),
    nameZh: v.string(),
    nameEn: v.string(),
    kind: v.union(v.literal("presidium"), v.literal("regular")),
    sortOrder: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_kind", ["kind"]),

  departmentMemberships: defineTable({
    userId: v.id("users"),
    departmentId: v.id("departments"),
    // In the presidium department, "lead" is 主席 (exactly one) and "member" is 副主席.
    role: membershipRole,
    addedBy: v.optional(v.id("users")),
    // Presidium only: set when a 主席 hands the role over, so retiring later records 前主席.
    wasChair: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_department", ["departmentId"])
    .index("by_user_department", ["userId", "departmentId"]),

  // Retired presidium members (前主席 / 前副主席). role "lead" = 前主席.
  formerPresidium: defineTable({
    userId: v.id("users"),
    role: membershipRole,
    retiredAt: v.number(),
  }).index("by_user", ["userId"]),

  // A member asking to deactivate their own account; 主席团 reviews it.
  deactivationRequests: defineTable({
    userId: v.id("users"),
    reason: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("declined"),
      v.literal("cancelled"),
    ),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  channels: defineTable({
    type: channelType,
    /** Group chats only; other types derive their name. */
    name: v.optional(v.string()),
    /** department and announcement channels; unset on the org-wide announcement channel. */
    departmentId: v.optional(v.id("departments")),
    dmKey: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    lastMessageAt: v.optional(v.number()),
    /** Messages older than this are purged. Unset means LIMITS.defaultRetentionDays. */
    retentionDays: v.optional(v.number()),
    // Group chats
    purpose: v.optional(v.string()),
    proposalId: v.optional(v.id("groupProposals")),
    endedAt: v.optional(v.number()),
  })
    .index("by_type", ["type"])
    .index("by_department", ["departmentId"])
    .index("by_dmKey", ["dmKey"]),

  /** Departments involved in a group chat. Their 部长 are members automatically. */
  groupDepartments: defineTable({
    channelId: v.id("channels"),
    departmentId: v.id("departments"),
  })
    .index("by_channel", ["channelId"])
    .index("by_department", ["departmentId"]),

  groupProposals: defineTable({
    proposerId: v.id("users"),
    name: v.string(),
    purpose: v.string(),
    departmentIds: v.array(v.id("departments")),
    suggestedUserIds: v.array(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled"),
      v.literal("expired"),
    ),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
    channelId: v.optional(v.id("channels")),
    expiresAt: v.number(),
  })
    .index("by_proposer", ["proposerId"])
    .index("by_status", ["status"]),

  // Read state for every channel a user has opened, plus explicit membership for DMs and groups.
  // Access to org, announcement, and department channels is derived from departmentMemberships.
  channelMembers: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    lastReadAt: v.number(),
    muted: v.optional(v.boolean()),
    /** Set for explicit DM and group members; read-state-only rows leave it unset. */
    joinedAt: v.optional(v.number()),
    addedBy: v.optional(v.id("users")),
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_channel_user", ["channelId", "userId"]),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    body: v.string(),
    kind: v.optional(v.union(v.literal("user"), v.literal("system"), v.literal("forward"))),
    mentionUserIds: v.optional(v.array(v.id("users"))),
    mentionAll: v.optional(v.boolean()),
    replyToId: v.optional(v.id("messages")),
    editedAt: v.optional(v.number()),
    recalledAt: v.optional(v.number()),
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id("users")),
    /** Lowercased body with CJK split into bigrams, for the search index. */
    searchText: v.optional(v.string()),
    /** kind "system": event name and params, translated on the client. */
    system: v.optional(v.object({ event: v.string(), params: v.any() })),
    /** kind "forward": snapshot of the forwarded messages. */
    forward: v.optional(v.any()),
  })
    .index("by_channel", ["channelId"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["channelId"] }),

  /** Earlier versions of edited messages. */
  messageEdits: defineTable({
    messageId: v.id("messages"),
    body: v.string(),
  }).index("by_message", ["messageId"]),

  messageReactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_user_emoji", ["messageId", "userId", "emoji"]),

  /** Uploaded chat files. Unsent uploads expire after a day, sent ones 15 days after sending. */
  attachments: defineTable({
    storageId: v.id("_storage"),
    thumbStorageId: v.optional(v.id("_storage")),
    name: v.string(),
    size: v.number(),
    contentType: v.string(),
    uploaderId: v.id("users"),
    messageId: v.optional(v.id("messages")),
    expiresAt: v.number(),
    /** Set once the stored files are deleted. */
    expiredAt: v.optional(v.number()),
  })
    .index("by_message", ["messageId"])
    .index("by_expiry", ["expiredAt", "expiresAt"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: notificationType,
    params: v.any(),
    /** In-app path, e.g. "/chat/?c=<id>&m=<id>". */
    link: v.optional(v.string()),
    readAt: v.optional(v.number()),
    messageId: v.optional(v.id("messages")),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "readAt"])
    .index("by_readAt", ["readAt"])
    .index("by_message", ["messageId"]),

  /** Web Push subscriptions, one per browser or installed home-screen app. */
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  // 接龙 (signup), 投票 (poll), 集会 (meeting) inside a chat.
  chatApps: defineTable({
    channelId: v.id("channels"),
    kind: v.union(v.literal("signup"), v.literal("poll"), v.literal("meeting")),
    status: v.union(
      v.literal("proposed"),
      v.literal("active"),
      v.literal("closed"),
      v.literal("rejected"),
      v.literal("cancelled"),
    ),
    title: v.string(),
    description: v.optional(v.string()),
    config: v.any(),
    createdBy: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    rejectReason: v.optional(v.string()),
    deadline: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    /** 集会: the chosen start slot index. */
    confirmedSlot: v.optional(v.number()),
  }).index("by_channel_status", ["channelId", "status"]),

  chatAppResponses: defineTable({
    appId: v.id("chatApps"),
    userId: v.id("users"),
    data: v.any(),
  })
    .index("by_app", ["appId"])
    .index("by_app_user", ["appId", "userId"])
    .index("by_user", ["userId"]),

  auditLogs: defineTable({
    actorId: v.optional(v.id("users")),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    subjectUserId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
  })
    .index("by_actor", ["actorId"])
    .index("by_subject", ["subjectUserId"])
    .index("by_action", ["action"]),
});
