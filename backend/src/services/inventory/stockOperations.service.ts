import { StockMovementType } from "@prisma/client";

import { AuditActions } from "../../constants/auditActions";
import { prisma } from "../../lib/prisma";
import { writeAuditLog } from "../audit.service";

import { syncProductTotalStock } from "./stockSync.service";

import type { Prisma } from "@prisma/client";

async function ensureProductBelongsToBranch(productId: string, branchId: string) {
  const p = await prisma.product.findFirst({
    where: { id: productId, branchId },
    select: { id: true },
  });
  if (!p) {
    throw new Error("PRODUCT_NOT_IN_BRANCH");
  }
}

async function ensureWarehouseInBranch(warehouseId: string, branchId: string) {
  const w = await prisma.warehouse.findFirst({
    where: { id: warehouseId, branchId },
    select: { id: true },
  });
  if (!w) {
    throw new Error("INVALID_WAREHOUSE");
  }
}

export async function applyStockIn(params: {
  branchId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  note?: string | null;
  reference?: string | null;
  userId: string;
  meta: { ip?: string; userAgent?: string };
}) {
  const { branchId, productId, warehouseId, quantity, note, reference, userId, meta } = params;
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error("INVALID_QTY");
  }
  await ensureProductBelongsToBranch(productId, branchId);
  await ensureWarehouseInBranch(warehouseId, branchId);

  await prisma.$transaction(async (tx) => {
    await tx.productStock.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      create: {
        productId,
        warehouseId,
        quantity,
      },
      update: {
        quantity: { increment: quantity },
      },
    });

    await tx.stockMovement.create({
      data: {
        productId,
        warehouseId,
        type: StockMovementType.IN,
        quantity,
        note: note ?? null,
        reference: reference ?? null,
        createdById: userId,
      },
    });

    await syncProductTotalStock(productId, tx);
  });

  await writeAuditLog({
    action: AuditActions.STOCK_IN,
    userId,
    entityType: "ProductStock",
    entityId: productId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { warehouseId, quantity, branchId },
  });
}

export async function applyStockOut(params: {
  branchId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  note?: string | null;
  reference?: string | null;
  userId: string;
  meta: { ip?: string; userAgent?: string };
}) {
  const { branchId, productId, warehouseId, quantity, note, reference, userId, meta } = params;
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error("INVALID_QTY");
  }
  await ensureProductBelongsToBranch(productId, branchId);
  await ensureWarehouseInBranch(warehouseId, branchId);

  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.productStock.findUnique({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
      });
      const available = row?.quantity ?? 0;
      if (available < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      await tx.productStock.update({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
        data: {
          quantity: { decrement: quantity },
        },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId,
          type: StockMovementType.OUT,
          quantity,
          note: note ?? null,
          reference: reference ?? null,
          createdById: userId,
        },
      });

      await syncProductTotalStock(productId, tx);
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_STOCK") throw e;
    throw e;
  }

  await writeAuditLog({
    action: AuditActions.STOCK_OUT,
    userId,
    entityType: "ProductStock",
    entityId: productId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { warehouseId, quantity, branchId },
  });
}

export async function applyStockTransfer(params: {
  branchId: string;
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  note?: string | null;
  userId: string;
  meta: { ip?: string; userAgent?: string };
}) {
  const { branchId, productId, fromWarehouseId, toWarehouseId, quantity, note, userId, meta } = params;
  if (fromWarehouseId === toWarehouseId) {
    throw new Error("SAME_WAREHOUSE");
  }
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error("INVALID_QTY");
  }
  await ensureProductBelongsToBranch(productId, branchId);
  await ensureWarehouseInBranch(fromWarehouseId, branchId);
  await ensureWarehouseInBranch(toWarehouseId, branchId);

  await prisma.$transaction(async (tx) => {
    const row = await tx.productStock.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId: fromWarehouseId },
      },
    });
    const available = row?.quantity ?? 0;
    if (available < quantity) {
      throw new Error("INSUFFICIENT_STOCK");
    }

    await tx.productStock.update({
      where: {
        productId_warehouseId: { productId, warehouseId: fromWarehouseId },
      },
      data: { quantity: { decrement: quantity } },
    });

    await tx.productStock.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId: toWarehouseId },
      },
      create: {
        productId,
        warehouseId: toWarehouseId,
        quantity,
      },
      update: {
        quantity: { increment: quantity },
      },
    });

    await tx.stockMovement.create({
      data: {
        productId,
        warehouseId: fromWarehouseId,
        type: StockMovementType.TRANSFER,
        quantity,
        toWarehouseId,
        note: note ?? null,
        createdById: userId,
      },
    });

    await syncProductTotalStock(productId, tx);
  });

  await writeAuditLog({
    action: AuditActions.STOCK_TRANSFER,
    userId,
    entityType: "ProductStock",
    entityId: productId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { fromWarehouseId, toWarehouseId, quantity, branchId },
  });
}

export async function listStockHistory(params: {
  productId: string;
  branchId: string;
  warehouseId?: string;
  limit: number;
}) {
  const { productId, branchId, warehouseId, limit } = params;
  await ensureProductBelongsToBranch(productId, branchId);

  const where: Prisma.StockMovementWhereInput = {
    productId,
    warehouse: { branchId },
    ...(warehouseId ? { warehouseId } : {}),
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
      toWarehouseId: true,
      createdAt: true,
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
    warehouse: r.warehouse,
    toWarehouse: r.toWarehouse,
    createdBy: r.createdBy,
  }));
}
