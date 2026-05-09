import { Prisma } from "@prisma/client";

import type { z } from "zod";

import { AuditActions } from "../constants/auditActions";
import { toDecimalString } from "../lib/money";
import { prisma } from "../lib/prisma";
import { adminProductCreateSchema, adminProductPatchSchema } from "../validation/schemas";
import { writeAuditLog } from "./audit.service";
import { getOrCreateDefaultWarehouse } from "./inventory/warehouse.service";
import { syncProductTotalStock } from "./inventory/stockSync.service";

type CreateIn = z.infer<typeof adminProductCreateSchema>;
type PatchIn = z.infer<typeof adminProductPatchSchema>;

function mapProduct(p: {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  price: unknown;
  cost: unknown | null;
  stockQty: number;
  lowStockAt: number | null;
  reorderLevel: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    description: p.description,
    category: p.category,
    price: Number(p.price),
    cost: p.cost != null ? Number(p.cost) : null,
    stockQty: p.stockQty,
    lowStockAt: p.lowStockAt,
    reorderLevel: p.reorderLevel,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listAdminProducts(branchId: string) {
  const rows = await prisma.product.findMany({
    where: { branchId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map(mapProduct);
}

export async function createAdminProduct(
  branchId: string,
  actorUserId: string,
  body: CreateIn,
  meta: { ip?: string; userAgent?: string },
) {
  const sku = body.sku;
  const name = body.name;
  const price = body.price;
  const stockQty = body.stockQty;
  const reorderLevel =
    body.reorderLevel === undefined || body.reorderLevel === null ? null : body.reorderLevel;
  const category =
    body.category === undefined || body.category === "" || body.category === null
      ? null
      : String(body.category).trim() || null;
  const description =
    body.description === undefined || body.description === "" || body.description === null
      ? null
      : String(body.description).trim() || null;
  const cost = body.cost === undefined ? null : body.cost;
  const lowStockAt =
    body.lowStockAt === undefined || body.lowStockAt === null ? null : body.lowStockAt;
  const isActive = body.isActive === false ? false : true;
  let barcode: string | null = null;
  if (body.barcode !== undefined && body.barcode !== null && body.barcode !== "") {
    const b = String(body.barcode).trim();
    barcode = b || null;
  }

  const p = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        branchId,
        sku,
        barcode,
        name,
        description,
        category,
        price: new Prisma.Decimal(toDecimalString(price)),
        cost: cost != null ? new Prisma.Decimal(toDecimalString(cost)) : null,
        stockQty: 0,
        lowStockAt,
        reorderLevel,
        isActive,
      },
    });

    const wh = await getOrCreateDefaultWarehouse(branchId, tx);

    await tx.productStock.create({
      data: {
        productId: product.id,
        warehouseId: wh.id,
        quantity: stockQty,
        minStock: lowStockAt,
        reorderPoint: reorderLevel,
      },
    });

    await syncProductTotalStock(product.id, tx);

    return tx.product.findUniqueOrThrow({
      where: { id: product.id },
    });
  });

  await writeAuditLog({
    action: AuditActions.PRODUCT_CREATE,
    userId: actorUserId,
    entityType: "Product",
    entityId: p.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { sku: p.sku },
  });

  return mapProduct(p);
}

async function adjustDefaultWarehouseStock(
  tx: Prisma.TransactionClient,
  branchId: string,
  productId: string,
  delta: number,
) {
  if (delta === 0) return;
  const wh = await getOrCreateDefaultWarehouse(branchId, tx);
  const row = await tx.productStock.findUnique({
    where: {
      productId_warehouseId: { productId, warehouseId: wh.id },
    },
  });
  const next = (row?.quantity ?? 0) + delta;
  if (next < 0) {
    throw new Error("INSUFFICIENT_STOCK");
  }
  await tx.productStock.upsert({
    where: {
      productId_warehouseId: { productId, warehouseId: wh.id },
    },
    create: {
      productId,
      warehouseId: wh.id,
      quantity: Math.max(0, delta),
    },
    update: {
      quantity: { increment: delta },
    },
  });
}

export async function updateAdminProduct(
  branchId: string,
  actorUserId: string,
  productId: string,
  body: PatchIn,
  meta: { ip?: string; userAgent?: string },
) {
  const data: Prisma.ProductUpdateInput = {};

  if (body.sku !== undefined) data.sku = body.sku;
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) {
    data.description =
      body.description === null || body.description === "" ? null : String(body.description).trim() || null;
  }
  if (body.category !== undefined) {
    data.category =
      body.category === null || body.category === "" ? null : String(body.category).trim() || null;
  }
  if (body.barcode !== undefined) {
    if (body.barcode === null || body.barcode === "") {
      data.barcode = null;
    } else {
      const b = String(body.barcode).trim();
      data.barcode = b || null;
    }
  }
  if (body.price !== undefined) {
    data.price = new Prisma.Decimal(toDecimalString(body.price));
  }
  if (body.cost !== undefined) {
    if (body.cost === null) {
      data.cost = null;
    } else {
      data.cost = new Prisma.Decimal(toDecimalString(body.cost));
    }
  }
  if (body.lowStockAt !== undefined) {
    data.lowStockAt = body.lowStockAt === null ? null : body.lowStockAt;
  }
  if (body.reorderLevel !== undefined) {
    data.reorderLevel = body.reorderLevel === null ? null : body.reorderLevel;
  }
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const stockQtyPatch = body.stockQty;

  const p = await prisma.$transaction(async (tx) => {
    if (stockQtyPatch !== undefined) {
      const current = await tx.product.findFirst({
        where: { id: productId, branchId },
        select: { stockQty: true },
      });
      if (!current) {
        throw new Error("NOT_FOUND");
      }
      const delta = stockQtyPatch - current.stockQty;
      await adjustDefaultWarehouseStock(tx, branchId, productId, delta);
      await syncProductTotalStock(productId, tx);
    }

    if (Object.keys(data).length === 0 && stockQtyPatch === undefined) {
      throw new Error("NO_FIELDS");
    }

    if (Object.keys(data).length > 0) {
      return tx.product.update({
        where: { id: productId, branchId },
        data,
      });
    }

    return tx.product.findUniqueOrThrow({
      where: { id: productId, branchId },
    });
  });

  await writeAuditLog({
    action: AuditActions.PRODUCT_UPDATE,
    userId: actorUserId,
    entityType: "Product",
    entityId: p.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { fields: Object.keys(body) },
  });

  return mapProduct(p);
}

/** Soft-delete: marks product inactive (cannot hard-delete if referenced by sales). */
export async function softDeleteAdminProduct(
  branchId: string,
  actorUserId: string,
  productId: string,
  meta: { ip?: string; userAgent?: string },
) {
  const p = await prisma.product.update({
    where: { id: productId, branchId },
    data: { isActive: false },
  });

  await writeAuditLog({
    action: AuditActions.PRODUCT_DELETE,
    userId: actorUserId,
    entityType: "Product",
    entityId: p.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { soft: true },
  });

  return mapProduct(p);
}
