import type { Request, Response, NextFunction } from "express";

import { tenantUsageStatus } from "../lib/subscription";

export async function requireTenantBillingActive(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }

  const status = await tenantUsageStatus(tenantId);
  if (!status) {
    res.status(404).json({ error: "Tenant not found", code: "TENANT_NOT_FOUND" });
    return;
  }

  if (!status.active) {
    res.status(403).json({ error: "Your subscription is expired or restricted", code: "TENANT_BILLING_RESTRICTED" });
    return;
  }

  req.tenantBillingStatus = status.tenant.billingStatus;
  req.tenantPlan = status.tenant.plan;
  req.tenantPlanExpiresAt = status.tenant.planExpiresAt;
  next();
}
