import { UserRole } from "@prisma/client";
import { Router } from "express";

import { createWarehouseForBranch, listWarehousesForBranch } from "../services/inventory/warehouse.service";
import { warehouseCreateSchema } from "../validation/schemas";

export const warehousesRouter = Router();

warehousesRouter.get("/", async (req, res) => {
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const warehouses = await listWarehousesForBranch(branchId);
  res.json({ warehouses });
});

warehousesRouter.post("/", async (req, res) => {
  if (req.userRole !== UserRole.ADMIN) {
    res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    return;
  }
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const parsed = warehouseCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION",
      details: parsed.error.flatten(),
    });
    return;
  }
  const warehouse = await createWarehouseForBranch(branchId, parsed.data);
  res.status(201).json({ warehouse });
});
