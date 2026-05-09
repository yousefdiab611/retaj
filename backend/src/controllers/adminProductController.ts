import { Prisma } from "@prisma/client";

import {
  createAdminProduct,
  listAdminProducts,
  softDeleteAdminProduct,
  updateAdminProduct,
} from "../services/adminProduct.service";
import { getClientIp, getUserAgent, firstPathParam } from "../utils/requestMeta";
import { adminProductCreateSchema, adminProductPatchSchema } from "../validation/schemas";

import type { Request, Response } from "express";

export const adminProductController = {
  async list(req: Request, res: Response) {
    const branchId = req.activeBranchId;
    if (!branchId) {
      res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
      return;
    }
    const products = await listAdminProducts(branchId);
    res.json({ products });
  },

  async create(req: Request, res: Response) {
    const branchId = req.activeBranchId;
    if (!branchId) {
      res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
      return;
    }
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }
    const parsed = adminProductCreateSchema.safeParse(req.body);
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
      const product = await createAdminProduct(branchId, userId, parsed.data, meta);
      res.status(201).json({ product });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        res.status(409).json({ error: "SKU or barcode already exists", code: "DUPLICATE" });
        return;
      }
      throw e;
    }
  },

  async update(req: Request, res: Response) {
    const branchId = req.activeBranchId;
    if (!branchId) {
      res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
      return;
    }
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }
    const id = firstPathParam(req.params.id);
    const parsed = adminProductPatchSchema.safeParse(req.body);
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
      const product = await updateAdminProduct(branchId, userId, id, parsed.data, meta);
      res.json({ product });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "INSUFFICIENT_STOCK") {
        res.status(400).json({ error: "Insufficient stock for adjustment", code: "INSUFFICIENT_STOCK" });
        return;
      }
      if (msg === "NO_FIELDS") {
        res.status(400).json({ error: "No changes applied", code: "NO_FIELDS" });
        return;
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2025") {
          res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
          return;
        }
        if (e.code === "P2002") {
          res.status(409).json({ error: "SKU or barcode already exists", code: "DUPLICATE" });
          return;
        }
      }
      throw e;
    }
  },

  async remove(req: Request, res: Response) {
    const branchId = req.activeBranchId;
    if (!branchId) {
      res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
      return;
    }
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }
    const id = firstPathParam(req.params.id);
    const meta = { ip: getClientIp(req), userAgent: getUserAgent(req) };
    try {
      const product = await softDeleteAdminProduct(branchId, userId, id, meta);
      res.json({ product });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
        return;
      }
      throw e;
    }
  },
};
