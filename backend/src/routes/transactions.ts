import { Router } from "express";

import { getTransactionForInvoice } from "../services/transactionInvoice.service";
import { createSaleTransaction } from "../services/transactionSale.service";
import { getClientIp, getUserAgent, firstPathParam } from "../utils/requestMeta";
import { createSaleBodySchema } from "../validation/schemas";

export const transactionsRouter = Router();

transactionsRouter.post("/", async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }

  const parsed = createSaleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION",
      details: parsed.error.flatten(),
    });
    return;
  }

  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }

  const meta = { ip: getClientIp(req), userAgent: getUserAgent(req) };
  const result = await createSaleTransaction(branchId, userId, parsed.data, meta);

  if (!result.ok) {
    if (result.code === "CUSTOMER_NOT_FOUND") {
      res.status(400).json({ error: "Customer not found", code: "CUSTOMER_NOT_FOUND" });
      return;
    }
    if (result.code === "CUSTOMER_REQUIRED") {
      res
        .status(400)
        .json({ error: "Customer is required for account or partial payment", code: "CUSTOMER_REQUIRED" });
      return;
    }
    if (result.code === "INVALID_PRODUCT") {
      res
        .status(400)
        .json({ error: "One or more products are invalid or inactive", code: "INVALID_PRODUCT" });
      return;
    }
    if (result.code === "INSUFFICIENT_STOCK") {
      res
        .status(400)
        .json({ error: "Insufficient stock for one or more products", code: "INSUFFICIENT_STOCK" });
      return;
    }
    if (result.code === "INVALID_WAREHOUSE") {
      res.status(400).json({ error: "Invalid warehouse for this branch", code: "INVALID_WAREHOUSE" });
      return;
    }
    if (result.code === "NO_WAREHOUSE") {
      res.status(400).json({
        error: "No warehouse configured for this branch; create one or set a default",
        code: "NO_WAREHOUSE",
      });
      return;
    }
    if (result.code === "IDEMPOTENCY_CONFLICT") {
      res.status(409).json({ error: "Idempotency key conflict", code: "IDEMPOTENCY_CONFLICT" });
      return;
    }
    res.status(409).json({ error: "Stock changed while processing; try again", code: "STOCK_RACE" });
    return;
  }

  res.status(201).json({ transaction: result.transaction });
});

transactionsRouter.get("/:id", async (req, res) => {
  const userId = req.userId;
  const role = req.userRole;
  if (!userId || !role) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }

  const id = firstPathParam(req.params.id);
  const data = await getTransactionForInvoice(
    id,
    userId,
    role,
    req.userBranchId ?? null,
    req.userTenantId ?? "",
  );
  if (!data) {
    res.status(404).json({ error: "Transaction not found", code: "NOT_FOUND" });
    return;
  }

  res.json({ transaction: data });
});
