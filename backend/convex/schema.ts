import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Stage 1 tables only. See doc/03-data-model.md for the full target schema.

export const userStatus = v.union(
  v.literal("new"),
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("deactivated"),
);

export const membershipRole = v.union(v.literal("lead"), v.literal("member"));

export const locale = v.union(v.literal("zh"), v.literal("en"));

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
    type: v.union(v.literal("org"), v.literal("department"), v.literal("dm")),
    departmentId: v.optional(v.id("departments")),
    dmKey: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_type", ["type"])
    .index("by_department", ["departmentId"])
    .index("by_dmKey", ["dmKey"]),

  // Read state for every channel a user has opened, plus membership for DMs.
  // Access to org and department channels is derived from departmentMemberships.
  channelMembers: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    lastReadAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_channel_user", ["channelId", "userId"]),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    body: v.string(),
  }).index("by_channel", ["channelId"]),

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
