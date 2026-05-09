import type { NextFunction, Request, Response } from "express";

import { AuditActions } from "../constants/auditActions";
import { prisma } from "../lib/prisma";
import { writeAuditLog } from "../services/audit.service";
import { verifyAccessToken } from "../lib/jwt";
import { logger } from "../lib/logger";
import { getClientIp, getUserAgent } from "../utils/requestMeta";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header", code: "UNAUTHORIZED" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Missing token", code: "UNAUTHORIZED" });
    return;
  }

  // Log suspicious auth attempts
  if (token.length > 10000) { // Unusually long token
    logger.warn({ ip: getClientIp(req), userAgent: getUserAgent(req) }, "suspicious_token_length");
  }

  try {
    const { sub: userId } = verifyAccessToken(token);
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        role: true,
        branchId: true,
        tenantId: true,
        username: true,
        name: true,
        tenant: {
          select: { isActive: true, plan: true, billingStatus: true, planExpiresAt: true },
        },
      },
    });
    if (!user || !user.tenant?.isActive) {
      // Log failed auth attempts
      await writeAuditLog({
        action: AuditActions.AUTH_FAILED,
        userId,
        tenantId: user?.tenantId,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        metadata: { reason: "user_inactive_or_tenant_inactive" },
      });
      res.status(401).json({ error: "User not found or inactive", code: "UNAUTHORIZED" });
      return;
    }
    req.userId = user.id;
    req.userRole = user.role;
    req.userTenantId = user.tenantId;
    req.userBranchId = user.branchId;
    req.userLoginName = user.username;
    req.userDisplayName = user.name;
    req.tenantPlan = user.tenant.plan;
    req.tenantBillingStatus = user.tenant.billingStatus;
    req.tenantPlanExpiresAt = user.tenant.planExpiresAt;
    req.tenantRestricted = user.tenant.billingStatus !== "ACTIVE" ||
      (!!user.tenant.planExpiresAt && user.tenant.planExpiresAt.getTime() < Date.now());
    next();
  } catch (err) {
    // Log token verification failures
    logger.warn({ err, ip: getClientIp(req), userAgent: getUserAgent(req) }, "token_verification_failed");
    res.status(401).json({ error: "Invalid or expired token", code: "UNAUTHORIZED" });
  }
}
