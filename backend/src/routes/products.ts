import { Router } from "express";

import { prisma } from "../lib/prisma";

export const productsRouter = Router();

const productPublicSelect = {
  id: true,
  sku: true,
  barcode: true,
  name: true,
  category: true,
  price: true,
  stockQty: true,
} as const;

const variantPublicSelect = {
  id: true,
  sku: true,
  barcode: true,
  size: true,
  color: true,
  priceOverride: true,
  stockQty: true,
} as const;

function mapProduct(p: {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string | null;
  price: unknown;
  stockQty: number;
  variants?: Array<{
    id: string;
    sku: string;
    barcode: string | null;
    size: string | null;
    color: string | null;
    priceOverride: unknown | null;
    stockQty: number;
  }>;
}) {
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    price: Number(p.price),
    category: p.category ?? "Uncategorized",
    stockQty: p.stockQty,
    variants:
      p.variants?.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        size: v.size,
        color: v.color,
        priceOverride: v.priceOverride != null ? Number(v.priceOverride) : null,
        stockQty: v.stockQty,
      })) ?? [],
  };
}

/** Resolve by barcode or SKU (for scanners and manual entry). */
productsRouter.get("/lookup", async (req, res) => {
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const warehouseId =
    typeof req.query.warehouseId === "string" && req.query.warehouseId.length > 0
      ? req.query.warehouseId
      : undefined;
  if (warehouseId) {
    const w = await prisma.warehouse.findFirst({
      where: { id: warehouseId, branchId },
      select: { id: true },
    });
    if (!w) {
      res.status(400).json({ error: "Invalid warehouse for branch", code: "INVALID_WAREHOUSE" });
      return;
    }
  }
  const raw = typeof req.query.code === "string" ? req.query.code.trim() : "";
  const code = raw.replace(/\s+/g, "");
  if (!code) {
    res.status(400).json({ error: "code query parameter is required" });
    return;
  }

  const variant = await prisma.productVariant.findFirst({
    where: {
      OR: [{ sku: code }, { barcode: code }],
      product: { branchId, isActive: true },
    },
    include: { product: true },
  });

  if (variant) {
    let stockQty = variant.stockQty;
    if (warehouseId) {
      const ps = await prisma.variantStock.findUnique({
        where: { productVariantId_warehouseId: { productVariantId: variant.id, warehouseId } },
        select: { quantity: true },
      });
      stockQty = ps?.quantity ?? 0;
    }
    res.json({
      product: {
        id: variant.product.id,
        sku: variant.product.sku,
        barcode: variant.product.barcode,
        name: `${variant.product.name} ${[variant.size, variant.color].filter(Boolean).join("/")}`.trim(),
        category: variant.product.category,
        price: Number(variant.priceOverride ?? variant.product.price),
        stockQty,
        variant: {
          id: variant.id,
          sku: variant.sku,
          barcode: variant.barcode,
          size: variant.size,
          color: variant.color,
          priceOverride: variant.priceOverride != null ? Number(variant.priceOverride) : null,
        },
      },
    });
    return;
  }

  const row = await prisma.product.findFirst({
    where: {
      branchId,
      isActive: true,
      OR: [{ sku: code }, { barcode: code }],
    },
    select: productPublicSelect,
  });
  if (!row) {
    res.status(404).json({ error: "No active product matches this code" });
    return;
  }
  let stockQty = row.stockQty;
  if (warehouseId) {
    const ps = await prisma.productStock.findUnique({
      where: {
        productId_warehouseId: { productId: row.id, warehouseId },
      },
      select: { quantity: true },
    });
    stockQty = ps?.quantity ?? 0;
  }
  res.json({ product: mapProduct({ ...row, stockQty }) });
});

productsRouter.get("/", async (req, res) => {
  const branchId = req.activeBranchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch context required", code: "BRANCH_REQUIRED" });
    return;
  }
  const warehouseId =
    typeof req.query.warehouseId === "string" && req.query.warehouseId.length > 0
      ? req.query.warehouseId
      : undefined;
  if (warehouseId) {
    const w = await prisma.warehouse.findFirst({
      where: { id: warehouseId, branchId },
      select: { id: true },
    });
    if (!w) {
      res.status(400).json({ error: "Invalid warehouse for branch", code: "INVALID_WAREHOUSE" });
      return;
    }
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const categoryFilter = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "";

  const baseWhere: any = { branchId, isActive: true };
  if (q) {
    baseWhere.AND = [
      {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
          {
            variants: {
              some: {
                OR: [
                  { sku: { contains: q, mode: "insensitive" } },
                  { barcode: { contains: q, mode: "insensitive" } },
                  { size: { contains: q, mode: "insensitive" } },
                  { color: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
    ];
  }

  if (categoryFilter) {
    baseWhere.category = { contains: categoryFilter, mode: "insensitive" };
  }

  const rows = await prisma.product.findMany({
    where: baseWhere,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      ...productPublicSelect,
      variants: {
        select: variantPublicSelect,
      },
    },
  });

  if (!warehouseId) {
    res.json({ products: rows.map(mapProduct) });
    return;
  }

  const productIds = rows.map((r) => r.id);
  const stocks = await prisma.productStock.findMany({
    where: {
      warehouseId,
      productId: { in: productIds },
    },
    select: { productId: true, quantity: true },
  });
  const qtyByProduct = new Map(stocks.map((s) => [s.productId, s.quantity]));

  const variantStocks = await prisma.variantStock.findMany({
    where: {
      warehouseId,
      productVariant: { productId: { in: productIds } },
    },
    select: { productVariantId: true, quantity: true },
  });
  const qtyByVariant = new Map(variantStocks.map((s) => [s.productVariantId, s.quantity]));

  res.json({
    products: rows.map((p) =>
      mapProduct({
        ...p,
        stockQty: qtyByProduct.get(p.id) ?? p.stockQty,
        variants: p.variants?.map((v) => ({
          ...v,
          stockQty: qtyByVariant.get(v.id) ?? v.stockQty,
        })),
      }),
    ),
  });
});
