import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type AuditEntry = {
  actorId?: Id<"users">;
  action: string;
  targetType: string;
  targetId: string;
  subjectUserId?: Id<"users">;
  metadata?: Record<string, unknown>;
};

export async function logAudit(ctx: MutationCtx, entry: AuditEntry) {
  await ctx.db.insert("auditLogs", entry);
}
