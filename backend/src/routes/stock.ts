import { Router } from "express";

import {
  applyStockIn,
  applyStockOut,
  applyStockTransfer,
  listStockHistory,
} from "../services/inventory/stockOperations.service";
import { getClientIp, getUserAgent, firstPathParam } from "../utils/requestMeta";
import {
  stockInBodySchema,
  stockOutBodySchema,
  stockTransferBodySchema,
} from "../validation/schemas";

export const stockRouter = Router();

stockRouter.post("/in", async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const parsed = stockInBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION",
      details: parsed.error.flatten(),
    });
    return;
  }
  const meta = { ip: getClientIp(req), userAgent: getUserAgent(req) };
  try {
    await applyStockIn({
      branchId,
      userId,
      meta,
      ...parsed.data,
    });
    res.status(204).send();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "PRODUCT_NOT_IN_BRANCH" || msg === "INVALID_WAREHOUSE") {
      res.status(400).json({ error: "Invalid product or warehouse", code: msg });
      return;
    }
    if (msg === "INVALID_QTY") {
      res.status(400).json({ error: "Invalid quantity", code: msg });
      return;
    }
    throw e;
  }
});

stockRouter.post("/out", async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const parsed = stockOutBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION",
      details: parsed.error.flatten(),
    });
    return;
  }
  const meta = { ip: getClientIp(req), userAgent: getUserAgent(req) };
  try {
    await applyStockOut({
      branchId,
      userId,
      meta,
      ...parsed.data,
    });
    res.status(204).send();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "PRODUCT_NOT_IN_BRANCH" || msg === "INVALID_WAREHOUSE") {
      res.status(400).json({ error: "Invalid product or warehouse", code: msg });
      return;
    }
    if (msg === "INVALID_QTY") {
      res.status(400).json({ error: "Invalid quantity", code: msg });
      return;
    }
    if (msg === "INSUFFICIENT_STOCK") {
      res.status(400).json({ error: "Insufficient stock", code: msg });
      return;
    }
    throw e;
  }
});

stockRouter.post("/transfer", async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const parsed = stockTransferBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION",
      details: parsed.error.flatten(),
    });
    return;
  }
  const meta = { ip: getClientIp(req), userAgent: getUserAgent(req) };
  try {
    await applyStockTransfer({
      branchId,
      userId,
      meta,
      ...parsed.data,
    });
    res.status(204).send();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "PRODUCT_NOT_IN_BRANCH" || msg === "INVALID_WAREHOUSE") {
      res.status(400).json({ error: "Invalid product or warehouse", code: msg });
      return;
    }
    if (msg === "INVALID_QTY") {
      res.status(400).json({ error: "Invalid quantity", code: msg });
      return;
    }
    if (msg === "SAME_WAREHOUSE") {
      res.status(400).json({ error: "Source and destination must differ", code: msg });
      return;
    }
    if (msg === "INSUFFICIENT_STOCK") {
      res.status(400).json({ error: "Insufficient stock", code: msg });
      return;
    }
    throw e;
  }
});

stockRouter.get("/history/:productId", async (req, res) => {
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const productId = firstPathParam(req.params.productId);
  const warehouseId =
    typeof req.query.warehouseId === "string" && req.query.warehouseId.length > 0
      ? req.query.warehouseId
      : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  try {
    const history = await listStockHistory({ productId, branchId, warehouseId, limit });
    res.json({ history });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "PRODUCT_NOT_IN_BRANCH") {
      res.status(404).json({ error: "Product not found in branch", code: "NOT_FOUND" });
      return;
    }
    throw e;
  }
});
