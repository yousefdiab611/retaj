import { UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma";

import type { NextFunction, Request, Response } from "express";

/**
 * Resolves `req.activeBranchId` for the request.
 * - CASHIER: always their assigned `req.userBranchId`.
 * - ADMIN / MANAGER: `X-Branch-Id` header, or optional `branchId` query (first wins). If omitted, `activeBranchId` stays null (all branches — e.g. reports).
 */
export async function resolveActiveBranch(req: Request, res: Response, next: NextFunction) {
  const role = req.userRole;
  const userBranchId = req.userBranchId ?? null;
  const tenantId = req.userTenantId;

  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }

  if (role === UserRole.CASHIER) {
    if (!userBranchId) {
      res.status(403).json({
        error: "Your account is not assigned to a branch. Contact an administrator.",
        code: "NO_BRANCH_ASSIGNMENT",
      });
      return;
    }
    const branch = await prisma.branch.findFirst({
      where: { id: userBranchId, tenantId },
      select: { id: true },
    });
    if (!branch) {
      res
        .status(403)
        .json({ error: "Branch assignment invalid for tenant", code: "INVALID_BRANCH_ASSIGNMENT" });
      return;
    }
    req.activeBranchId = branch.id;
    return next();
  }

  const headerRaw = req.headers["x-branch-id"];
  const headerBid = typeof headerRaw === "string" ? headerRaw.trim() : "";
  const queryBid = typeof req.query.branchId === "string" ? req.query.branchId.trim() : "";

  const requested = headerBid || queryBid || "";
  if (!requested) {
    req.activeBranchId = null;
    return next();
  }

  const branch = await prisma.branch.findFirst({
    where: { id: requested, tenantId },
    select: { id: true },
  });
  if (!branch) {
    res.status(400).json({ error: "Invalid branch", code: "INVALID_BRANCH" });
    return;
  }
  req.activeBranchId = branch.id;
  next();
}

/** Inventory / POS routes require an explicit branch for admins (cashiers already set above). */
export function requireBranchSelected(req: Request, res: Response, next: NextFunction) {
  if (!req.activeBranchId) {
    res.status(400).json({
      error: "Branch context required. Send X-Branch-Id header with a valid branch id.",
      code: "BRANCH_REQUIRED",
    });
    return;
  }
  next();
}
