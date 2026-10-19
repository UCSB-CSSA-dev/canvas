# 03 Data Model (Convex Schema Draft)

This is the target `backend/convex/schema.ts` for all stages. It is a draft: field names and indexes may be refined during implementation, but **any change must be reflected here**. For what is deployed today, `backend/convex/schema.ts` is authoritative.

Conventions:

- Every Convex document has `_id` and `_creationTime` automatically. Don't add `createdAt` unless a different time is needed.
- Timestamps are `number` (ms since epoch).
- Soft delete uses `deletedAt?: number`. Queries must filter out soft-deleted rows unless the caller is presidium reviewing them.
- Bilingual display data uses `nameZh` / `nameEn` pairs (see [05-i18n.md](05-i18n.md)).

## Tables by stage

Only create the tables for the current stage (see [09-roadmap.md](09-roadmap.md)); later tables are added when their stage starts.

| Stage | Tables |
| --- | --- |
| 1 | `users` (+ Convex Auth tables), `departments`, `departmentMemberships`, `formerPresidium`, `deactivationRequests`, `preApprovals`, `channels`, `channelMembers`, `messages`, `auditLogs` |
| 2 | `messageReactions`, `notifications` |
| 3 | `folders`, `files`, `assignments`, `assignmentSubmissions`, `assignmentComments`, `emailJobs` |
| 4 | TBA (likely embedding tables with vector indexes for AI features) |

Stage 1 implements a subset of the fields below and adds the rest when their stage starts:

- `channels.type` is only `"org"`, `"department"`, or `"dm"`; there is no `name` or `archivedAt` yet, and `createdBy` is optional because seeded channels have no creator.
- `channelMembers` has only `channelId`, `userId`, and `lastReadAt` (no `role` or `muted`).
- `messages` has only `channelId`, `authorId`, and `body` (attachments, mentions, replies, edit, and delete come in Stage 2).
- `departmentMemberships.addedBy` and `auditLogs.actorId` are optional so the seed and system events can write rows.

## Entity relationships

```mermaid
erDiagram
  users ||--o{ departmentMemberships : has
  departments ||--o{ departmentMemberships : has
  departments ||--o{ preApprovals : "invites into"
  users ||--o{ preApprovals : creates
  departments ||--o{ channels : owns
  channels ||--o{ channelMembers : has
  users ||--o{ channelMembers : joins
  channels ||--o{ messages : contains
  messages ||--o{ messageReactions : has
  departments ||--o{ folders : owns
  folders ||--o{ folders : parent
  folders ||--o{ files : contains
  users ||--o{ files : uploads
  users ||--o{ assignments : creates
  assignments ||--o{ assignmentSubmissions : "one per assignee"
  assignments ||--o{ assignmentComments : has
  users ||--o{ notifications : receives
  users ||--o{ auditLogs : acts
```

## Schema

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const attachment = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
});

export default defineSchema({
  ...authTables, // Convex Auth tables; `users` is overridden below

  // ---------- Accounts ----------
  users: defineTable({
    // Fields managed by Convex Auth (keep them optional as Convex Auth expects)
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // App fields
    isSystemAdmin: v.optional(v.boolean()),   // first account; see 02-roles-and-permissions.md
    status: v.optional(v.union(
      v.literal("new"),          // signed in, onboarding not submitted
      v.literal("pending"),      // submitted, waiting for approval
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("deactivated"),
    )),
    nameZh: v.optional(v.string()),           // 中文名
    nameEn: v.optional(v.string()),           // English name
    bio: v.optional(v.string()),              // public, max 160 chars
    avatarStorageId: v.optional(v.id("_storage")), // uploaded photo (256px JPEG)
    avatarUrl: v.optional(v.string()),        // overrides the Google `image`, which sign-in rewrites
    wechatId: v.optional(v.string()),
    major: v.optional(v.string()),
    graduationYear: v.optional(v.number()),
    requestedDepartmentIds: v.optional(v.array(v.id("departments"))), // chosen at onboarding
    applicationNote: v.optional(v.string()),
    oversightConsentAt: v.optional(v.number()),
    oversightConsentVersion: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    locale: v.optional(v.union(v.literal("zh"), v.literal("en"))),
    emailPrefs: v.optional(v.object({
      assignments: v.boolean(),     // new assignment + due-soon reminders
      mentions: v.boolean(),        // @mention digest
      announcements: v.boolean(),
    })),
    lastSeenAt: v.optional(v.number()),
  })
    .index("email", ["email"])           // required by Convex Auth
    .index("by_status", ["status"])
    .index("by_isSystemAdmin", ["isSystemAdmin"]),

  // Emails placed into the hierarchy before the person signs in.
  // One row per (email, department). Claimed on first sign-in / onboarding.
  preApprovals: defineTable({
    email: v.string(),                   // lowercased, must end with @ucsb.edu
    departmentId: v.id("departments"),
    role: v.union(v.literal("lead"), v.literal("member")),
    note: v.optional(v.string()),        // e.g. "2026 秋季新部员"
    createdBy: v.id("users"),
    claimedAt: v.optional(v.number()),
    claimedBy: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
    revokedBy: v.optional(v.id("users")),
  })
    .index("by_email", ["email"])
    .index("by_department", ["departmentId"])
    .index("by_email_department", ["email", "departmentId"]),

  // ---------- Organization ----------
  departments: defineTable({
    slug: v.string(),                    // "events", "international", "publicity", "presidium"
    nameZh: v.string(),                  // "活动部"
    nameEn: v.string(),                  // "Events"
    kind: v.union(v.literal("presidium"), v.literal("regular")),
    descriptionZh: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    sortOrder: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_kind", ["kind"]),

  departmentMemberships: defineTable({
    userId: v.id("users"),
    departmentId: v.id("departments"),
    // In 主席团: "lead" = 主席, "member" = 副主席. Elsewhere: 部长 / 部员.
    role: v.union(v.literal("lead"), v.literal("member")),
    addedBy: v.id("users"),
    wasChair: v.optional(v.boolean()),   // 主席团 only: was 主席 earlier this term
  })
    .index("by_user", ["userId"])
    .index("by_department", ["departmentId"])
    .index("by_department_role", ["departmentId", "role"])
    .index("by_user_department", ["userId", "departmentId"]),

  // 前主席 / 前副主席: people who retired from 主席团.
  formerPresidium: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("lead"), v.literal("member")),  // "lead" = 前主席
    retiredAt: v.number(),
  }).index("by_user", ["userId"]),

  // ---------- Chat ----------
  channels: defineTable({
    type: v.union(
      v.literal("org"),            // org-wide general channel
      v.literal("department"),     // one per department, auto-membership
      v.literal("announcement"),   // org-wide (departmentId unset) or per department
      v.literal("group"),          // user-created group chat
      v.literal("dm"),             // exactly two members
    ),
    name: v.optional(v.string()),            // group chats; others derive name
    departmentId: v.optional(v.id("departments")),
    dmKey: v.optional(v.string()),           // sorted "userIdA:userIdB" for DM uniqueness
    createdBy: v.id("users"),
    lastMessageAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
  })
    .index("by_type", ["type"])
    .index("by_department", ["departmentId"])
    .index("by_dmKey", ["dmKey"]),

  channelMembers: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")), // group chat admin
    lastReadAt: v.number(),
    muted: v.boolean(),
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_channel_user", ["channelId", "userId"]),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    body: v.string(),                        // plain text with lightweight markdown
    attachments: v.array(attachment),
    mentionUserIds: v.array(v.id("users")),
    replyToId: v.optional(v.id("messages")),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
  })
    .index("by_channel", ["channelId"])                 // ordered by _creationTime
    .index("by_author", ["authorId"])
    .searchIndex("search_body", { searchField: "body", filterFields: ["channelId"] }),

  messageReactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_user_emoji", ["messageId", "userId", "emoji"]),

  // ---------- Files ----------
  folders: defineTable({
    name: v.string(),
    scope: v.union(v.literal("org"), v.literal("department"), v.literal("personal")),
    departmentId: v.optional(v.id("departments")), // scope = department
    ownerId: v.optional(v.id("users")),            // scope = personal
    parentId: v.optional(v.id("folders")),         // undefined = root of its scope
    createdBy: v.id("users"),
    deletedAt: v.optional(v.number()),
  })
    .index("by_parent", ["parentId"])
    .index("by_scope_department", ["scope", "departmentId"])
    .index("by_scope_owner", ["scope", "ownerId"]),

  files: defineTable({
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    folderId: v.id("folders"),
    // denormalized from folder for fast permission checks
    scope: v.union(v.literal("org"), v.literal("department"), v.literal("personal")),
    departmentId: v.optional(v.id("departments")),
    uploadedBy: v.id("users"),
    description: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_folder", ["folderId"])
    .index("by_uploader", ["uploadedBy"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["scope", "departmentId"] }),

  // ---------- Assignments ----------
  assignments: defineTable({
    title: v.string(),
    description: v.string(),                 // markdown
    createdBy: v.id("users"),
    departmentId: v.optional(v.id("departments")), // the department this work is for
    dueAt: v.optional(v.number()),
    status: v.union(v.literal("draft"), v.literal("open"), v.literal("closed")),
    requiresSubmission: v.boolean(),         // false = just "mark done"
    attachments: v.array(attachment),
    publishedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
  })
    .index("by_creator", ["createdBy"])
    .index("by_department", ["departmentId"])
    .index("by_status_due", ["status", "dueAt"]),

  // One row per assignee, created when the assignment is published.
  assignmentSubmissions: defineTable({
    assignmentId: v.id("assignments"),
    assigneeId: v.id("users"),
    status: v.union(
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("submitted"),
      v.literal("changes_requested"),
      v.literal("approved"),
    ),
    text: v.optional(v.string()),
    attachments: v.array(attachment),
    link: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    dueSoonReminderSentAt: v.optional(v.number()),
    overdueReminderSentAt: v.optional(v.number()),
  })
    .index("by_assignment", ["assignmentId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_assignee_status", ["assigneeId", "status"])
    .index("by_assignment_assignee", ["assignmentId", "assigneeId"]),

  // Feedback thread on a specific submission
  assignmentComments: defineTable({
    submissionId: v.id("assignmentSubmissions"),
    authorId: v.id("users"),
    body: v.string(),
  }).index("by_submission", ["submissionId"]),

  // ---------- Notifications and email ----------
  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("account_approved"),
      v.literal("account_rejected"),
      v.literal("mention"),
      v.literal("assignment_new"),
      v.literal("assignment_due_soon"),
      v.literal("assignment_overdue"),
      v.literal("submission_received"),
      v.literal("submission_reviewed"),
      v.literal("added_to_department"),
      v.literal("announcement"),
    ),
    params: v.any(),                  // values interpolated into the translated message
    link: v.optional(v.string()),     // in-app path without locale, e.g. "/assignments/abc"
    readAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "readAt"]),

  emailJobs: defineTable({
    to: v.string(),
    userId: v.optional(v.id("users")),
    template: v.string(),             // see 06-email-apps-script.md
    locale: v.union(v.literal("zh"), v.literal("en")),
    params: v.any(),
    status: v.union(v.literal("queued"), v.literal("sending"), v.literal("sent"), v.literal("failed")),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    sendAfter: v.number(),
    sentAt: v.optional(v.number()),
    dedupeKey: v.optional(v.string()), // e.g. "due_soon:<submissionId>"
  })
    .index("by_status_sendAfter", ["status", "sendAfter"])
    .index("by_dedupeKey", ["dedupeKey"]),

  // ---------- Audit ----------
  auditLogs: defineTable({
    actorId: v.id("users"),
    action: v.string(),               // e.g. "user.approve", "oversight.channel.open"
    targetType: v.string(),           // "user" | "channel" | "file" | "submission" | "department" | "message"
    targetId: v.string(),
    subjectUserId: v.optional(v.id("users")), // whose content was accessed, if any
    metadata: v.optional(v.any()),
  })
    .index("by_actor", ["actorId"])
    .index("by_subject", ["subjectUserId"])
    .index("by_action", ["action"]),
});
```

## Table notes

### users

- Created by Convex Auth on first Google sign-in. A `createOrUpdateUser` callback (or `afterUserCreatedOrUpdated`) sets `status = "new"` and default `locale = "zh"` and `emailPrefs`.
- The `@ucsb.edu` domain check happens in the auth callback, **before** a user row is created. See [features/accounts-and-onboarding.md](features/accounts-and-onboarding.md).
- Display name: `nameZh` when locale is `zh` and it exists, otherwise `nameEn`, otherwise `name` from Google.

### preApprovals

- Created from the roster page by admins and leads (see [features/roster.md](features/roster.md#pre-approving-emails)).
- "Active" = `claimedAt`, `revokedAt` both unset. At most one active row per `(email, departmentId)`; pre-approving the same email and department again updates the role instead of inserting.
- Claimed in the same mutation that approves the user and creates the `departmentMemberships` rows. See [features/accounts-and-onboarding.md](features/accounts-and-onboarding.md#pre-approved-emails).
- If the email already belongs to an **approved** user, the membership is applied immediately and the row is marked claimed at creation time.
- Kept after claiming as a record of who invited whom.

### departments

- Seeded: 主席团 (`presidium`, kind `presidium`), plus regular departments such as 活动部 (`events`), 国际部 (`international`), 宣传部 (`publicity`). The full list is configurable by presidium.
- Creating a department also creates its `department` channel (Stage 1). Later stages also create a department `announcement` channel and a root department folder.

### departmentMemberships

- The source of truth for who belongs where. Access to department channels is **derived** from these rows at read time (see below), so adding or removing a membership needs no channel bookkeeping and can't drift.
- Every write that can create a lead goes through `assignMembership` in `convex/lib/memberships.ts`, which enforces one 主席 (`CHAIR_EXISTS`, `CHAIR_REQUIRED`) and at most 2 leads per regular department (`TOO_MANY_LEADS`). See [02-roles-and-permissions.md](02-roles-and-permissions.md#主席-and-副主席).
- A pre-approval for a lead seat that has filled up by the time the user signs in is claimed as `member` instead.

### deactivationRequests

```ts
deactivationRequests: defineTable({
  userId: v.id("users"),
  reason: v.optional(v.string()),
  status: v.union(v.literal("pending"), v.literal("approved"), v.literal("declined"), v.literal("cancelled")),
  reviewedBy: v.optional(v.id("users")),
  reviewedAt: v.optional(v.number()),
  reviewNote: v.optional(v.string()),   // shown to the member
})
  .index("by_user", ["userId"])
  .index("by_status", ["status"]),
```

- A member asks to deactivate their own account from `/settings`; admins review it on the roster. See [features/accounts-and-onboarding.md](features/accounts-and-onboarding.md#deactivation).
- At most one `pending` request per user. Deactivating the user any other way also closes their pending request as `approved`.
- From Stage 3, approving a request also records a keep-or-delete decision for each of the member's files (shape TBD with the files tables).

### formerPresidium

- Written by `presidium.retire`. Shown on the roster under 主席团 as 往届 with a 前主席 / 前副主席 badge. No permissions come from it.
- Hidden while the person is back in 主席团; if someone has several rows, 前主席 wins.

### channels and channelMembers

- Who can read a channel (`canReadChannel` in `backend/convex/lib/permissions.ts`):
  - `org`: every approved user.
  - `department`: admins, plus anyone with a `departmentMemberships` row for that department.
  - `dm`: only the two users with a `channelMembers` row.
- `channelMembers` therefore has two jobs: it is the **membership list for DMs** (both rows are created with the channel), and the **read state** (`lastReadAt`) for every channel. For `org` and `department` channels the row is created lazily the first time the user opens the channel or sends a message.
- `dm` channels are unique per pair via `dmKey` (sorted user IDs joined with `:`).
- Unread count = messages from other people with `_creationTime > lastReadAt`. With no row yet, `lastReadAt` defaults to the time the user was approved (or their account creation time). Displayed as `99+` above 99.
- Oversight readers are **not** added to `channelMembers`.

### messages

- Soft delete keeps the row: `deletedAt` and `deletedBy` are set and normal viewers see "消息已删除 / Message deleted". Whether the original body is kept for presidium is an [open question](10-open-questions.md).
- Paginate with `.withIndex("by_channel", q => q.eq("channelId", id)).order("desc").paginate(opts)`.

### folders and files

- Root folders: one `org` root, one root per department, and one `personal` root per user, created lazily.
- `files.scope` and `files.departmentId` are copied from the folder and updated when a file moves.

### assignments and assignmentSubmissions

- Assigning to a whole department expands to individual `assignmentSubmissions` rows at publish time. Members who join later are not added automatically, but a lead can add them.
- Assignment `status` is the creator's control (open or closed). Per-person progress lives in `assignmentSubmissions.status`.

### auditLogs

- Append-only. No update or delete functions are exposed.

## Seed data (`convex/seed.ts`, internal)

1. Create departments: presidium, events, international, publicity (the rest are added from the roster page), each with its department channel.
2. Create the `org` general channel. From Stage 2 on: the org-wide announcement channel. From Stage 3 on: the org root folder.
3. The seed is idempotent (safe to run twice) and runs automatically when the first user is created if no departments exist yet.

There is no manual admin bootstrap step: the first account to sign in becomes system admin. See [features/accounts-and-onboarding.md](features/accounts-and-onboarding.md#first-account-becomes-system-admin).
