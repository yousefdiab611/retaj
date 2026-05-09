import { Router } from "express";

import { getDatabaseStatus } from "../lib/dbBootstrap";
import { processOfflineSyncBatch } from "../services/offlineSync.service";
import { getClientIp, getUserAgent } from "../utils/requestMeta";
import { offlineSyncBodySchema } from "../validation/schemas";

export const syncRouter = Router();

syncRouter.get("/status", async (_req, res) => {
  const dbStatus = getDatabaseStatus();
  res.json({ ok: true, syncEngine: dbStatus.syncEngineStatus, database: dbStatus });
});

syncRouter.post("/offline-transactions", async (req, res) => {
  const userId = req.userId;
  const role = req.userRole;
  if (!userId || !role) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }

  const parsed = offlineSyncBodySchema.safeParse(req.body);
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
  const out = await processOfflineSyncBatch(branchId, userId, role, parsed.data.items, meta);
  res.status(200).json(out);
});
