import { Prisma } from "@prisma/client";
import { Router } from "express";

import { createTenant, getTenantById, listTenants, updateTenant } from "../services/tenant.service";
import { firstPathParam } from "../utils/requestMeta";
import { tenantCreateSchema, tenantPatchSchema } from "../validation/schemas";

export const tenantsRouter = Router();

tenantsRouter.get("/", async (_req, res) => {
  const tenants = await listTenants();
  res.json({ tenants });
});

tenantsRouter.post("/", async (req, res) => {
  const parsed = tenantCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION",
      details: parsed.error.flatten(),
    });
    return;
  }
  const tenant = await createTenant(parsed.data);
  res.status(201).json({ tenant });
});

tenantsRouter.get("/:id", async (req, res) => {
  const id = firstPathParam(req.params.id);
  const tenant = await getTenantById(id);
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found", code: "NOT_FOUND" });
    return;
  }
  res.json({ tenant });
});

tenantsRouter.patch("/:id", async (req, res) => {
  const id = firstPathParam(req.params.id);
  const parsed = tenantPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION",
      details: parsed.error.flatten(),
    });
    return;
  }
  try {
    const payload = {
      ...parsed.data,
      planExpiresAt:
        parsed.data.planExpiresAt === undefined
          ? undefined
          : parsed.data.planExpiresAt
            ? new Date(parsed.data.planExpiresAt)
            : null,
    };
    const tenant = await updateTenant(id, payload);
    res.json({ tenant });
  } catch (e) {
    if (
      (e as Error & { code?: string }).code === "P2025" ||
      (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
    ) {
      res.status(404).json({ error: "Tenant not found", code: "NOT_FOUND" });
      return;
    }
    throw e;
  }
});
