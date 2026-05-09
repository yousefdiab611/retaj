import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { writeAuditLog } from "../services/audit.service";
import { AuditActions } from "../constants/auditActions";

export const customerController = {
  async getProfile(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    const userId = req.userId;
    if (!tenantId || !userId) {
      res.status(400).json({ error: "User context required", code: "USER_REQUIRED" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        tenantId: true,
        branchId: true,
      },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, plan: true, billingStatus: true, planExpiresAt: true },
    });

    res.json({ user, tenant });
  },

  async getSubscription(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
      return;
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    res.json({ subscriptions });
  },

  async getLicenses(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
      return;
    }
    const licenses = await prisma.license.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
    res.json({ licenses });
  },

  async getDevices(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
      return;
    }
    const devices = await prisma.device.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" } });
    res.json({ devices });
  },

  async revokeDevice(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    const deviceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
      return;
    }
    const result = await prisma.device.updateMany({ where: { id: deviceId ?? "", tenantId }, data: { isActive: false } });
    if (result.count === 0) {
      res.status(404).json({ error: "Device not found", code: "NOT_FOUND" });
      return;
    }
    await writeAuditLog({
      action: AuditActions.LICENSE_ACTIVATION_FAILURE,
      tenantId,
      userId: req.userId,
      entityType: "Device",
      entityId: deviceId,
      metadata: { action: "revoke" },
    });
    res.status(204).send();
  },

  async createSupportTicket(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    const userId = req.userId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
      return;
    }
    const subject = String(req.body.subject ?? "").trim();
    const description = String(req.body.description ?? "").trim();
    if (!subject || !description) {
      res.status(400).json({ error: "Subject and description are required", code: "VALIDATION" });
      return;
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId,
        userId,
        subject,
        description,
      },
    });

    await writeAuditLog({
      action: AuditActions.TRANSACTION_CREATE,
      tenantId,
      userId,
      entityType: "SupportTicket",
      entityId: ticket.id,
      metadata: { subject },
    });

    res.status(201).json({ ticket });
  },
};
