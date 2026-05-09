import type { UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { reportTopMovingProducts } from "./inventory/inventoryReports.service";

export type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  createdAt: string;
};

function mapBranch(b: { id: string; name: string; address: string | null; phone: string | null; createdAt: Date }): BranchRow {
  return {
    id: b.id,
    name: b.name,
    address: b.address,
    phone: b.phone,
    createdAt: b.createdAt.toISOString(),
  };
}

export async function listBranchesForRequester(
  role: UserRole,
  userBranchId: string | null,
  tenantId: string,
) {
  if (role === "CASHIER") {
    if (!userBranchId) return [] as BranchRow[];
    const b = await prisma.branch.findFirst({
      where: { id: userBranchId, tenantId },
    });
    return b ? [mapBranch(b)] : [];
  }
  const rows = await prisma.branch.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  return rows.map(mapBranch);
}

export async function createBranch(
  tenantId: string,
  data: { name: string; address?: string | null; phone?: string | null },
) {
  const row = await prisma.branch.create({
    data: {
      tenantId,
      name: data.name.trim(),
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      warehouses: {
        create: {
          name: "Main warehouse",
          isDefault: true,
          location: null,
        },
      },
    },
  });
  return mapBranch(row);
}

export async function updateBranch(
  tenantId: string,
  branchId: string,
  data: { name?: string; address?: string | null; phone?: string | null },
) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId } });
  if (!branch) {
    const err = new Error("Branch not found") as Error & { code?: string };
    err.code = "P2025";
    throw err;
  }

  const row = await prisma.branch.update({
    where: { id: branchId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
    },
  });
  return mapBranch(row);
}

export async function getBranchStats(branchId: string, tenantId: string, from: Date, to: Date) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId }, select: { id: true } });
  if (!branch) {
    const err = new Error("Branch not found") as Error & { code: string };
    err.code = "P2025";
    throw err;
  }

  const whereTxn = {
    branchId,
    status: "COMPLETED" as const,
    createdAt: { gte: from, lte: to },
  };

  const [agg, activeProductCount, stocks, topMoving] = await Promise.all([
    prisma.transaction.aggregate({
      where: whereTxn,
      _count: { _all: true },
      _sum: { total: true, tax: true, discount: true, subtotal: true },
    }),
    prisma.product.count({ where: { branchId, isActive: true } }),
    prisma.productStock.findMany({
      where: {
        warehouse: { branchId },
        product: { branchId, isActive: true },
      },
      include: {
        product: { select: { lowStockAt: true, reorderLevel: true } },
      },
    }),
    reportTopMovingProducts({ branchId, from, to, limit: 5 }),
  ]);

  function thresholdFor(s: (typeof stocks)[0]): number | null {
    const ps = s;
    const fromRow = ps.minStock ?? ps.reorderPoint;
    if (fromRow != null) return fromRow;
    return ps.product.lowStockAt ?? ps.product.reorderLevel ?? null;
  }

  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const s of stocks) {
    if (s.quantity <= 0) {
      outOfStockCount++;
      continue;
    }
    const th = thresholdFor(s);
    if (th != null && s.quantity <= th) {
      lowStockCount++;
    }
  }

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    transactions: {
      count: agg._count._all,
      revenue: Number(agg._sum.total ?? 0),
      tax: Number(agg._sum.tax ?? 0),
      discount: Number(agg._sum.discount ?? 0),
      subtotal: Number(agg._sum.subtotal ?? 0),
    },
    inventory: {
      activeProducts: activeProductCount,
      lowStockCount,
      outOfStockCount,
      topMoving,
    },
  };
}
