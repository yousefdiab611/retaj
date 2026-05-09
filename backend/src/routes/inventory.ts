import { Router } from "express";

import {
  getInventoryDashboard,
  reportInventoryValuation,
  reportLossDamage,
  reportStockByWarehouse,
  reportStockMovements,
  reportTopMovingProducts,
} from "../services/inventory/inventoryReports.service";

export const inventoryRouter = Router();

function parseRange(query: Record<string, unknown>): { from: Date; to: Date } | null {
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

inventoryRouter.get("/dashboard", async (req, res) => {
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const range = parseRange(req.query as Record<string, unknown>);
  if (!range) {
    res.status(400).json({ error: "Invalid from/to date range", code: "VALIDATION" });
    return;
  }
  const dash = await getInventoryDashboard(branchId, range.from, range.to);
  res.json(dash);
});

inventoryRouter.get("/reports/stock-by-warehouse", async (req, res) => {
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const rows = await reportStockByWarehouse(branchId);
  res.json({ stockByWarehouse: rows });
});

inventoryRouter.get("/reports/valuation", async (req, res) => {
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const valuation = await reportInventoryValuation(branchId);
  res.json(valuation);
});

inventoryRouter.get("/reports/movements", async (req, res) => {
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const q = req.query as Record<string, unknown>;
  const range = parseRange(q);
  const from = range?.from;
  const to = range?.to;
  const warehouseId = typeof q.warehouseId === "string" ? q.warehouseId : undefined;
  const productId = typeof q.productId === "string" ? q.productId : undefined;
  const limit = Math.min(Math.max(Number(q.limit) || 200, 1), 1000);
  const movements = await reportStockMovements({
    branchId,
    from,
    to,
    warehouseId,
    productId,
    limit,
  });
  res.json({ movements });
});

inventoryRouter.get("/reports/top-moving", async (req, res) => {
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const range = parseRange(req.query as Record<string, unknown>);
  if (!range) {
    res.status(400).json({ error: "Invalid from/to date range", code: "VALIDATION" });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const topMoving = await reportTopMovingProducts({ branchId, ...range, limit });
  res.json({ topMoving });
});

inventoryRouter.get("/reports/loss-damage", async (req, res) => {
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const range = parseRange(req.query as Record<string, unknown>);
  if (!range) {
    res.status(400).json({ error: "Invalid from/to date range", code: "VALIDATION" });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const entries = await reportLossDamage({ branchId, ...range, limit });
  res.json({ lossDamage: entries });
});
