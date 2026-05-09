import type { Request, Response } from "express";
import { LicenseStatus, PaymentStatus, Prisma } from "@prisma/client";

import { createLicenseRecord } from "../services/license.service";
import { prisma } from "../lib/prisma";
import { writeAuditLog } from "../services/audit.service";
import { getDatabaseStatus } from "../lib/dbBootstrap";
import { AuditActions } from "../constants/auditActions";

function parsePositiveInteger(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeId(id: string | string[] | undefined): string | undefined {
  return Array.isArray(id) ? id[0] : id;
}

export const adminController = {
  async dashboardStats(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
      return;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [customers, activeSubscriptions, activeLicenses, expiredLicenses, revenue, failedLogins, todayOrders, todayRevenue, pendingOfflineQueue, lastOfflineSync, newCustomers, tenant] = await Promise.all([
      prisma.customer.count({ where: { tenantId } }),
      prisma.subscription.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.license.count({ where: { tenantId, status: LicenseStatus.ACTIVE } }),
      prisma.license.count({ where: { tenantId, status: LicenseStatus.EXPIRED } }),
      prisma.payment.aggregate({
        where: { tenantId, status: PaymentStatus.SUCCEEDED, createdAt: { gte: thirtyDaysAgo } },
        _sum: { amountCents: true },
      }),
      prisma.auditLog.count({ where: { tenantId, action: AuditActions.LOGIN_FAILURE } }),
      prisma.transaction.count({ where: { tenantId, status: "COMPLETED", createdAt: { gte: todayStart } } }),
      prisma.transaction.aggregate({
        where: { tenantId, status: "COMPLETED", createdAt: { gte: todayStart } },
        _sum: { total: true },
      }),
      prisma.transaction.count({ where: { tenantId, status: "PENDING" } }),
      prisma.transaction.findFirst({
        where: { tenantId, idempotencyKey: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.customer.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, billingStatus: true, planExpiresAt: true } }),
    ]);

    const topProductsRaw = await prisma.transactionLine.groupBy({
      by: ["productId"],
      where: {
        transaction: { tenantId, status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
      },
      _sum: {
        quantity: true,
        lineTotal: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });
    const productIds = topProductsRaw.map((row) => row.productId);
    const topProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const topProductMap = new Map(topProducts.map((product) => [product.id, product.name]));

    const lowStockCountResult = await prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*) AS count FROM "Product" p JOIN "Branch" b ON p."branchId" = b.id WHERE b."tenantId" = ${tenantId} AND p."lowStockAt" IS NOT NULL AND p."stockQty" <= p."lowStockAt"`,
    );
    const lowStockCount = Number(lowStockCountResult[0]?.count ?? 0);

    const lastBackup = await prisma.backup.findFirst({
      where: { tenantId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { completedAt: true },
    });

    const dbStatus = getDatabaseStatus();

    res.json({
      totalCustomers: customers,
      activeSubscriptions,
      activeLicenses,
      expiredLicenses,
      monthlyRevenue: Number((revenue._sum.amountCents ?? 0) as number) / 100,
      failedLogins,
      ordersToday: todayOrders,
      revenueToday: Number((todayRevenue._sum.total ?? 0) as number),
      pendingOfflineSyncs: pendingOfflineQueue,
      lastOfflineSyncAt: lastOfflineSync?.createdAt?.toISOString() ?? null,
      newCustomers,
      licenseStatus: tenant?.billingStatus ?? "UNKNOWN",
      plan: tenant?.plan ?? "FREE",
      lastBackupAt: lastBackup?.completedAt?.toISOString() ?? null,
      appVersion: process.env.npm_package_version ?? process.env.APP_VERSION ?? "1.0.0",
      lowStockCount,
      topProducts: topProductsRaw.map((row) => ({
        productId: row.productId,
        name: topProductMap.get(row.productId) ?? "Unknown product",
        quantitySold: Number(row._sum.quantity ?? 0),
        revenue: Number(row._sum.lineTotal ?? 0),
      })),
      databaseStatus: dbStatus,
    });
  },

  async listLicenses(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
      return;
    }

    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = parsePositiveInteger(String(req.query.page ?? ""), 1);
    const pageSize = Math.min(parsePositiveInteger(String(req.query.pageSize ?? ""), 25), 100);

    const where: Record<string, unknown> = { tenantId };
    if (status) {
      where.status = status;
    }

    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.license.count({ where }),
    ]);

    res.json({ licenses, total, page, pageSize });
  },

  async createLicense(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
      return;
    }

    const expiresInDays = Number(req.body.expiresInDays ?? 0);
    const trialMode = Boolean(req.body.trialMode);
    const graceDays = Number(req.body.graceDays ?? 7);
    const expiresAt = expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    const license = await createLicenseRecord({
      tenantId,
      expiresAt,
      trialMode,
      graceDays,
      deviceId: req.body.deviceId ?? null,
      deviceFingerprint: req.body.deviceFingerprint ?? null,
    });

    await writeAuditLog({
      action: AuditActions.LICENSE_GENERATED,
      tenantId,
      userId: req.userId,
      entityType: "License",
      entityId: null,
      metadata: { trialMode, expiresAt: expiresAt?.toISOString() ?? null },
    });

    res.status(201).json({ license });
  },

  async revokeLicense(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    const licenseId = normalizeId(req.params.id);
    if (!tenantId || !licenseId) {
      res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
      return;
    }

    const license = await prisma.license.updateMany({
      where: { id: licenseId, tenantId },
      data: { status: LicenseStatus.REVOKED, deviceId: null, deviceFingerprint: null },
    });
    if (license.count === 0) {
      res.status(404).json({ error: "License not found", code: "NOT_FOUND" });
      return;
    }

    await writeAuditLog({
      action: AuditActions.LICENSE_ACTIVATION_FAILURE,
      tenantId,
      userId: req.userId,
      entityType: "License",
      entityId: licenseId,
      metadata: { reason: "revoked" },
    });

    res.status(204).send();
  },

  async extendLicense(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    const licenseId = normalizeId(req.params.id);
    const expiresInDays = Number(req.body.expiresInDays ?? 0);
    if (!tenantId || !licenseId || expiresInDays <= 0) {
      res.status(400).json({ error: "Invalid request", code: "VALIDATION" });
      return;
    }

    const license = await prisma.license.findFirst({ where: { id: licenseId, tenantId } });
    if (!license) {
      res.status(404).json({ error: "License not found", code: "NOT_FOUND" });
      return;
    }

    const nextExpiry = license.expiresAt ? new Date(license.expiresAt.getTime() + expiresInDays * 24 * 60 * 60 * 1000) : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const updated = await prisma.license.update({ where: { id: licenseId }, data: { expiresAt: nextExpiry, status: LicenseStatus.ACTIVE } });

    await writeAuditLog({
      action: AuditActions.LICENSE_GENERATED,
      tenantId,
      userId: req.userId,
      entityType: "License",
      entityId: licenseId,
      metadata: { action: "extended", expiresInDays, expiresAt: nextExpiry.toISOString() },
    });

    res.json({ license: updated });
  },

  async bindLicense(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    const licenseId = normalizeId(req.params.id);
    const deviceId = req.body.deviceId;
    const deviceFingerprint = req.body.deviceFingerprint;
    if (!tenantId || !licenseId || !deviceId || !deviceFingerprint) {
      res.status(400).json({ error: "Device binding data required", code: "VALIDATION" });
      return;
    }

    const license = await prisma.license.updateMany({
      where: { id: licenseId, tenantId },
      data: { deviceId, deviceFingerprint, status: LicenseStatus.ACTIVE },
    });
    if (license.count === 0) {
      res.status(404).json({ error: "License not found", code: "NOT_FOUND" });
      return;
    }

    await writeAuditLog({
      action: AuditActions.LICENSE_ACTIVATION_SUCCESS,
      tenantId,
      userId: req.userId,
      entityType: "License",
      entityId: licenseId,
      metadata: { deviceId },
    });

    res.status(204).send();
  },

  async unbindLicense(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    const licenseId = normalizeId(req.params.id);
    if (!tenantId || !licenseId) {
      res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
      return;
    }

    const license = await prisma.license.updateMany({
      where: { id: licenseId, tenantId },
      data: { deviceId: null, deviceFingerprint: null },
    });
    if (license.count === 0) {
      res.status(404).json({ error: "License not found", code: "NOT_FOUND" });
      return;
    }

    await writeAuditLog({
      action: AuditActions.LICENSE_ACTIVATION_FAILURE,
      tenantId,
      userId: req.userId,
      entityType: "License",
      entityId: licenseId,
      metadata: { action: "unbind" },
    });

    res.status(204).send();
  },

  async listCustomers(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
      return;
    }

    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const where = {
      tenantId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { email: { contains: query, mode: "insensitive" as const } },
              { phone: { contains: query, mode: "insensitive" as const } },
              { ownerName: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        paymentBalance: true,
        loyaltyPoints: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ customers });
  },

  async getCustomer(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    const customerId = normalizeId(req.params.id);
    if (!tenantId || !customerId) {
      res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
      return;
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        transactions: true,
      },
    });
    if (!customer) {
      res.status(404).json({ error: "Customer not found", code: "NOT_FOUND" });
      return;
    }

    res.json({ customer });
  },

  async listAuditLogs(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
      return;
    }

    const page = parsePositiveInteger(String(req.query.page ?? ""), 1);
    const pageSize = Math.min(parsePositiveInteger(String(req.query.pageSize ?? ""), 25), 200);
    const action = typeof req.query.action === "string" ? req.query.action : undefined;

    const where: Record<string, unknown> = { tenantId };
    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page, pageSize });
  },

  async listSubscriptions(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
      return;
    }
    const subscriptions = await prisma.subscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ subscriptions });
  },

  async listPayments(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
      return;
    }
    const payments = await prisma.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ payments });
  },
};
