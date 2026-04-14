import type { PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "CLOSE" | "CANCEL" | "COMPLETE";

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const bVal = JSON.stringify(before[key]);
    const aVal = JSON.stringify(after[key]);
    if (bVal !== aVal) {
      diff[key] = { before: before[key], after: after[key] };
    }
  }

  return diff;
}

export async function writeAudit(
  prisma: PrismaClient,
  options: {
    entity: string;
    entityId: string;
    action: AuditAction;
    changedBy: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    request?: FastifyRequest;
  },
) {
  const diff =
    options.before && options.after
      ? computeDiff(options.before as Record<string, unknown>, options.after as Record<string, unknown>)
      : null;

  await prisma.auditLog.create({
    data: {
      entity: options.entity,
      entityId: options.entityId,
      action: options.action,
      changedBy: options.changedBy,
      before: options.before ? JSON.parse(JSON.stringify(options.before)) : undefined,
      after: options.after ? JSON.parse(JSON.stringify(options.after)) : undefined,
      diff: diff ? JSON.parse(JSON.stringify(diff)) : undefined,
      ipAddress: options.request?.ip ?? null,
      userAgent: options.request?.headers["user-agent"] ?? null,
    },
  });
}
