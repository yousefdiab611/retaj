import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
      userTenantId?: string;
      tenantPlan?: string;
      tenantBillingStatus?: string;
      tenantPlanExpiresAt?: Date | null;
      tenantRestricted?: boolean;
      /** Login username (nullable for legacy rows). */
      userLoginName?: string | null;
      /** Display / full name. */
      userDisplayName?: string;
      /** Assigned branch for cashiers; optional for admin/manager. */
      userBranchId?: string | null;
      /** Resolved branch for this request (POS/inventory). Null for admin when not specified = all branches (reports). */
      activeBranchId?: string | null;
    }
  }
}

export {};
