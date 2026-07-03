import { z } from "zod";

import { getDatabaseStatus, isDatabaseOnline } from "../lib/dbBootstrap";
import { logger } from "../lib/logger";
import { isFreshInstall, performInitialSetup } from "../services/setup.service";

import type { Request, Response } from "express";

const initialSetupSchema = z.object({
  businessName: z.string().trim().min(1).max(200),
  branchName: z.string().trim().min(1).max(200).default("Main"),
  adminName: z.string().trim().min(1).max(200),
  adminUsername: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, digits, dot, underscore or hyphen"),
  adminPassword: z.string().min(8).max(128),
  adminEmail: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  storePhone: z.string().trim().max(50).optional(),
  storeAddress: z.string().trim().max(500).optional(),
});

export const setupController = {
  async getStatus(_req: Request, res: Response) {
    if (!isDatabaseOnline()) {
      res.status(503).json({
        error: "Database unavailable",
        code: "DATABASE_UNAVAILABLE",
        status: getDatabaseStatus(),
      });
      return;
    }

    const fresh = await isFreshInstall();
    res.json({ needsSetup: fresh });
  },

  async runInitialSetup(req: Request, res: Response) {
    if (!isDatabaseOnline()) {
      res.status(503).json({
        error: "Database unavailable",
        code: "DATABASE_UNAVAILABLE",
        status: getDatabaseStatus(),
      });
      return;
    }

    const parsed = initialSetupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION",
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await performInitialSetup(parsed.data);
    if (!result.ok) {
      if (result.code === "ALREADY_INITIALIZED") {
        res.status(409).json({
          error: "This installation has already been initialized.",
          code: "ALREADY_INITIALIZED",
        });
        return;
      }
      if (result.code === "USERNAME_TAKEN") {
        res.status(409).json({
          error: "Username is already in use.",
          code: "USERNAME_TAKEN",
        });
        return;
      }
      res.status(500).json({ error: "Setup failed", code: "INTERNAL" });
      return;
    }

    logger.info({ tenantId: result.tenantId, userId: result.userId }, "initial_setup_completed");
    res.status(201).json({
      ok: true,
      tenantId: result.tenantId,
      branchId: result.branchId,
      userId: result.userId,
    });
  },
};
