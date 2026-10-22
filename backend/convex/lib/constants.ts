// Shared with the frontend (imported via @cssa-hub/backend). Keep free of server-only imports.

/** v2 (Stage 2): retention, recall, the monitored icon, and public profiles. */
export const CURRENT_CONSENT_VERSION = 2;

export const DEFAULT_ALLOWED_EMAIL_DOMAIN = "ucsb.edu";

export const LIMITS = {
  messageBody: 4000,
  nameLength: 60,
  applicationNote: 500,
  rejectionReason: 500,
  preApprovalNote: 200,
  preApprovalBatch: 100,
  departmentName: 40,
  messagesPageSize: 50,
  unreadCountCap: 99,
  /** Unacknowledged announcements loaded for the bar at the top of a chat. */
  announcementBar: 20,
  leadsPerDepartment: 2,
  bio: 160,
  /** Avatars are resized to 256px in the browser; this only guards against bypassing that. */
  avatarBytes: 1024 * 1024,
  deactivationReason: 500,

  // Chat (Stage 2)
  recallWindowMs: 5 * 60 * 1000,
  defaultRetentionDays: 15,
  attachmentBytes: 15 * 1024 * 1024,
  attachmentsPerMessage: 10,
  attachmentRetentionDays: 15,
  unsentUploadHours: 24,
  thumbnailBytes: 200 * 1024,
  attachmentName: 200,
  groupName: 40,
  groupPurpose: 200,
  groupMembers: 100,
  groupProposalDays: 14,
  reviewNote: 500,
  forwardMessages: 50,
  forwardTargets: 5,
  forwardBytes: 200_000,
  forwardDepth: 3,
  searchResults: 50,
  searchTerms: 16,
  aroundMessages: 25,
  notificationRetentionDays: 90,
  oversightLogWindowMs: 10 * 60 * 1000,
  purgeBatch: 500,
  fanoutBatch: 200,

  // Chat apps (Stage 2)
  appsPerChannel: 5,
  appTitle: 80,
  appDescription: 500,
  signupEntry: 200,
  signupExample: 100,
  signupCap: 500,
  pollOptionsMin: 2,
  pollOptionsMax: 20,
  pollOption: 80,
  pollOther: 100,
  meetingSlotMinutes: 30,
  appDueSoonMs: 24 * 60 * 60 * 1000,
  bestTimes: 5,
} as const;

/** Allowed values for channels.retentionDays. */
export const RETENTION_OPTIONS = [15, 30, 90, 180, 365] as const;

export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🙏", "✅", "🔥"] as const;

export const NOTIFICATION_TYPES = [
  "mention",
  "reply",
  "announcement",
  "added_to_group",
  "added_to_department",
  "deactivation_reviewed",
  "group_proposed",
  "group_approved",
  "group_rejected",
  "group_expired",
  "group_takeover",
  "app_proposed",
  "app_approved",
  "app_rejected",
  "app_due_soon",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "NOT_APPROVED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INVALID",
  "ALREADY_REVIEWED",
  "LAST_SYSTEM_ADMIN",
  "DOMAIN_NOT_ALLOWED",
  /** 主席团 already has a 主席; use presidium.transferChair. */
  "CHAIR_EXISTS",
  /** The action would leave 主席团 without its 主席; transfer the role first. */
  "CHAIR_REQUIRED",
  "TOO_MANY_LEADS",
  /** The 5-minute recall window has passed. */
  "RECALL_EXPIRED",
  "FILE_TOO_LARGE",
  "TOO_MANY_APPS",
  /** A 接龙 reached its cap. */
  "SIGNUP_FULL",
  /** The chat is read-only (ended group, archived department, deactivated DM partner). */
  "READ_ONLY",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const SEED_DEPARTMENTS = [
  { slug: "presidium", nameZh: "主席团", nameEn: "Presidium", kind: "presidium" },
  { slug: "events", nameZh: "活动部", nameEn: "Events", kind: "regular" },
  { slug: "international", nameZh: "国际部", nameEn: "International", kind: "regular" },
  { slug: "publicity", nameZh: "宣传部", nameEn: "Publicity", kind: "regular" },
] as const;
