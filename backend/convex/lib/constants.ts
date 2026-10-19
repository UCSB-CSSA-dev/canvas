// Shared with the frontend (imported via @cssa-hub/backend). Keep free of server-only imports.

export const CURRENT_CONSENT_VERSION = 1;

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
  leadsPerDepartment: 2,
  bio: 160,
  /** Avatars are resized to 256px in the browser; this only guards against bypassing that. */
  avatarBytes: 1024 * 1024,
  deactivationReason: 500,
} as const;

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
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const SEED_DEPARTMENTS = [
  { slug: "presidium", nameZh: "主席团", nameEn: "Presidium", kind: "presidium" },
  { slug: "events", nameZh: "活动部", nameEn: "Events", kind: "regular" },
  { slug: "international", nameZh: "国际部", nameEn: "International", kind: "regular" },
  { slug: "publicity", nameZh: "宣传部", nameEn: "Publicity", kind: "regular" },
] as const;
