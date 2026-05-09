import type { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma";

function movementWhereBranch(branchId: string): Prisma.StockMovementWhereInput {
  return {
    OR: [
      { warehouse: { branchId } },
      { toWarehouse: { branchId } },
    ],
  };
}

/** Stock rows per warehouse with product info and valuation (cost * qty). */
export async function reportStockByWarehouse(branchId: string) {
  const stocks = await prisma.productStock.findMany({
    where: {
      warehouse: { branchId },
      product: { branchId, isActive: true },
    },
    orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
    include: {
      warehouse: { select: { id: true, name: true, location: true, isDefault: true } },
      product: { select: { id: true, sku: true, name: true, cost: true } },
    },
  });

  return stocks.map((s) => ({
    warehouse: s.warehouse,
    product: {
      id: s.product.id,
      sku: s.product.sku,
      name: s.product.name,
    },
    quantity: s.quantity,
    minStock: s.minStock,
    reorderPoint: s.reorderPoint,
    valuation:
      s.product.cost != null ? Number(s.product.cost) * s.quantity : null,
  }));
}

export async function reportInventoryValuation(branchId: string) {
  const stocks = await prisma.productStock.findMany({
    where: {
      warehouse: { branchId },
      product: { branchId },
    },
    include: {
      product: { select: { cost: true } },
    },
  });
  let total = 0;
  for (const s of stocks) {
    if (s.product.cost != null) {
      total += Number(s.product.cost) * s.quantity;
    }
  }
  return { totalValuation: Math.round(total * 100) / 100 };
}

export async function reportStockMovements(params: {
  branchId: string;
  from?: Date;
  to?: Date;
  warehouseId?: string;
  productId?: string;
  limit: number;
}) {
  const { branchId, from, to, warehouseId, productId, limit } = params;
  const where: Prisma.StockMovementWhereInput = {
    AND: [
      movementWhereBranch(branchId),
      ...(warehouseId
        ? [{ OR: [{ warehouseId }, { toWarehouseId: warehouseId }] }]
        : []),
      ...(productId ? [{ productId }] : []),
      ...(from || to
        ? [
            {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            },
          ]
        : []),
    ],
  };

  const rows = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      quantity: true,
      reference: true,
      note: true,
      transactionId: true,
      createdAt: true,
      product: { select: { id: true, sku: true, name: true } },
      warehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    quantity: r.quantity,
    reference: r.reference,
    note: r.note,
    transactionId: r.transactionId,
    createdAt: r.createdAt.toISOString(),
    product: r.product,
    warehouse: r.warehouse,
    toWarehouse: r.toWarehouse,
    createdBy: r.createdBy,
  }));
}

/** OUT movements — filter client-side or by note keywords for loss/damage. */
export async function reportLossDamage(params: { branchId: string; from: Date; to: Date; limit: number }) {
  const rows = await prisma.stockMovement.findMany({
    where: {
      type: "OUT",
      warehouse: { branchId: params.branchId },
      createdAt: { gte: params.from, lte: params.to },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit,
    select: {
      id: true,
      quantity: true,
      note: true,
      reference: true,
      createdAt: true,
      product: { select: { id: true, sku: true, name: true } },
      warehouse: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  const kw = /damage|loss|spoil|waste|break|destroy|expired/i;
  return rows.map((r) => ({
    id: r.id,
    quantity: r.quantity,
    note: r.note,
    reference: r.reference,
    createdAt: r.createdAt.toISOString(),
    product: r.product,
    warehouse: r.warehouse,
    createdBy: r.createdBy,
    flagged: r.note ? kw.test(r.note) : false,
  }));
}

export async function reportTopMovingProducts(params: {
  branchId: string;
  from: Date;
  to: Date;
  limit: number;
}) {
  const grouped = await prisma.transactionLine.groupBy({
    by: ["productId"],
    where: {
      transaction: {
        branchId: params.branchId,
        status: "COMPLETED",
        createdAt: { gte: params.from, lte: params.to },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: params.limit,
  });

  const ids = grouped.map((g) => g.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, sku: true, name: true },
  });
  const map = new Map(products.map((p) => [p.id, p]));

  return grouped.map((g) => ({
    product: map.get(g.productId) ?? { id: g.productId, sku: "", name: "" },
    quantitySold: g._sum.quantity ?? 0,
  }));
}

function effectiveLowThreshold(ps: {
  quantity: number;
  minStock: number | null;
  reorderPoint: number | null;
  product: { lowStockAt: number | null; reorderLevel: number | null };
}): number | null {
  const fromRow = ps.minStock ?? ps.reorderPoint;
  if (fromRow != null) return fromRow;
  return ps.product.lowStockAt ?? ps.product.reorderLevel ?? null;
}

/** Dashboard: low stock, out of stock, fast movers (same window as branch stats). */
export async function getInventoryDashboard(branchId: string, from: Date, to: Date) {
  const stocks = await prisma.productStock.findMany({
    where: {
      warehouse: { branchId },
      product: { branchId, isActive: true },
    },
    include: {
      warehouse: { select: { id: true, name: true } },
      product: { select: { id: true, sku: true, name: true, lowStockAt: true, reorderLevel: true } },
    },
  });

  const lowStock: typeof stocks = [];
  const outOfStock: typeof stocks = [];

  for (const s of stocks) {
    if (s.quantity <= 0) {
      outOfStock.push(s);
      continue;
    }
    const th = effectiveLowThreshold(s);
    if (th != null && s.quantity <= th) {
      lowStock.push(s);
    }
  }

  const topMoving = await reportTopMovingProducts({
    branchId,
    from,
    to,
    limit: 10,
  });

  return {
    lowStock: lowStock.map((s) => ({
      productId: s.product.id,
      sku: s.product.sku,
      name: s.product.name,
      warehouseId: s.warehouse.id,
      warehouseName: s.warehouse.name,
      quantity: s.quantity,
      threshold: effectiveLowThreshold(s),
    })),
    outOfStock: outOfStock.map((s) => ({
      productId: s.product.id,
      sku: s.product.sku,
      name: s.product.name,
      warehouseId: s.warehouse.id,
      warehouseName: s.warehouse.name,
    })),
    topMoving,
  };
}
