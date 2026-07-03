import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

import type { AuditAction } from "../constants/auditActions";
import type { Prisma } from "@prisma/client";

type LogParams = {
  action: AuditAction;
  tenantId?: string | null;
  branchId?: string | null;
  entityType?: string;
  entityId?: string | null;
  userId?: string | null;
  ip?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(params: LogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId ?? null,
        branchId: params.branchId ?? null,
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        userId: params.userId ?? null,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        metadata: params.metadata === undefined ? undefined : params.metadata,
      },
    });
  } catch (e) {
    logger.error({ err: e, action: params.action }, "audit_write_failed");
  }
}
