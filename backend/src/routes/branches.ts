import { Prisma, UserRole } from "@prisma/client";
import { Router } from "express";

import {
  createBranch,
  getBranchStats,
  listBranchesForRequester,
  updateBranch,
} from "../services/branch.service";
import { firstPathParam } from "../utils/requestMeta";
import { branchCreateSchema, branchPatchSchema } from "../validation/schemas";

export const branchesRouter = Router();

branchesRouter.get("/", async (req, res) => {
  const role = req.userRole ?? UserRole.CASHIER;
  const uid = req.userBranchId ?? null;
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }
  const branches = await listBranchesForRequester(role, uid, tenantId);
  res.json({ branches });
});

branchesRouter.post("/", async (req, res) => {
  if (req.userRole !== UserRole.ADMIN && req.userRole !== UserRole.TENANT_ADMIN) {
    res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    return;
  }
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }
  const parsed = branchCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION",
      details: parsed.error.flatten(),
    });
    return;
  }
  const branch = await createBranch(tenantId, parsed.data);
  res.status(201).json({ branch });
});

branchesRouter.patch("/:id", async (req, res) => {
  if (req.userRole !== UserRole.ADMIN && req.userRole !== UserRole.TENANT_ADMIN) {
    res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    return;
  }
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }
  const id = firstPathParam(req.params.id);
  const parsed = branchPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION",
      details: parsed.error.flatten(),
    });
    return;
  }
  try {
    const branch = await updateBranch(tenantId, id, parsed.data);
    res.json({ branch });
  } catch (e) {
    if (
      (e as Error & { code?: string }).code === "P2025" ||
      (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
    ) {
      res.status(404).json({ error: "Branch not found", code: "NOT_FOUND" });
      return;
    }
    throw e;
  }
});

function parseStatsRange(query: Record<string, unknown>): { from: Date; to: Date } | null {
  const fromRaw = typeof query.from === "string" ? query.from : "";
  const toRaw = typeof query.to === "string" ? query.to : "";
  if (fromRaw && toRaw) {
    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
      return { from, to };
    }
    return null;
  }
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

branchesRouter.get("/:id/stats", async (req, res) => {
  const id = firstPathParam(req.params.id);
  const role = req.userRole ?? UserRole.CASHIER;

  if (role === UserRole.CASHIER) {
    if (!req.userBranchId || req.userBranchId !== id) {
      res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
      return;
    }
  }

  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }

  const range = parseStatsRange(req.query as Record<string, unknown>);
  if (!range) {
    res.status(400).json({ error: "Invalid from/to date range", code: "VALIDATION" });
    return;
  }

  try {
    const stats = await getBranchStats(id, tenantId, range.from, range.to);
    res.json(stats);
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "P2025") {
      res.status(404).json({ error: "Branch not found", code: "NOT_FOUND" });
      return;
    }
    throw e;
  }
});
