import { Prisma, StockMovementType } from "@prisma/client";

import { AuditActions } from "../constants/auditActions";
import { TAX_RATE } from "../lib/constants";
import { toDecimalString, roundMoney2 } from "../lib/money";
import { prisma } from "../lib/prisma";

import { writeAuditLog } from "./audit.service";
import { syncProductTotalStock } from "./inventory/stockSync.service";
import { resolveWarehouseIdForSale } from "./inventory/warehouse.service";

import type { createSaleBodySchema } from "../validation/schemas";
import type { z } from "zod";

type SaleInput = z.infer<typeof createSaleBodySchema>;

export type SaleResult = {
  id: string;
  reference: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string | null;
  createdAt: string;
};

export async function createSaleTransaction(
  branchId: string,
  userId: string,
  parsed: SaleInput,
  meta: { ip?: string; userAgent?: string },
): Promise<
  | { ok: true; transaction: SaleResult; idempotentReplay?: boolean }
  | {
      ok: false;
      code:
        | "INVALID_PRODUCT"
        | "INVALID_VARIANT"
        | "INSUFFICIENT_STOCK"
        | "STOCK_RACE"
        | "CUSTOMER_NOT_FOUND"
        | "INVALID_WAREHOUSE"
        | "NO_WAREHOUSE"
        | "IDEMPOTENCY_CONFLICT"
        | "CUSTOMER_REQUIRED";
    }
> {
  const idem = parsed.idempotencyKey;
  if (idem) {
    const existing = await prisma.transaction.findUnique({
      where: { idempotencyKey: idem },
      select: {
        id: true,
        reference: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
        paymentMethod: true,
        createdAt: true,
        userId: true,
        branchId: true,
      },
    });
    if (existing) {
      if (existing.userId !== userId || existing.branchId !== branchId) {
        return { ok: false, code: "IDEMPOTENCY_CONFLICT" };
      }
      const transaction: SaleResult = {
        id: existing.id,
        reference: existing.reference,
        subtotal: Number(existing.subtotal),
        discount: Number(existing.discount),
        tax: Number(existing.tax),
        total: Number(existing.total),
        paymentMethod: existing.paymentMethod,
        createdAt: existing.createdAt.toISOString(),
      };
      return { ok: true, transaction, idempotentReplay: true };
    }
  }

  const { paymentMethod, lineItems } = parsed;
  const discount = roundMoney2(parsed.discount ?? 0);
  const paidAmount = roundMoney2(parsed.paidAmount ?? 0);

  let warehouseId: string;
  try {
    warehouseId = await resolveWarehouseIdForSale(branchId, parsed.warehouseId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INVALID_WAREHOUSE") return { ok: false, code: "INVALID_WAREHOUSE" };
    if (msg === "NO_WAREHOUSE") return { ok: false, code: "NO_WAREHOUSE" };
    throw e;
  }

  const branchMeta = await prisma.branch.findUnique({ where: { id: branchId }, select: { tenantId: true } });
  if (!branchMeta) {
    throw new Error("INVALID_BRANCH");
  }

  const customerIdRaw = parsed.customerId;
  let customerId: string | null = null;
  if (customerIdRaw !== undefined && customerIdRaw !== null && customerIdRaw !== "") {
    const c = await prisma.customer.findFirst({
      where: { id: customerIdRaw, tenantId: branchMeta.tenantId },
    });
    if (!c) {
      return { ok: false, code: "CUSTOMER_NOT_FOUND" };
    }
    customerId = c.id;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const variantIds = lineItems
        .map((item) => item.productVariantId)
        .filter((v): v is string => typeof v === "string");
      const productIds = lineItems.map((item) => item.productId);

      const products = await tx.product.findMany({
        where: { id: { in: productIds }, branchId, isActive: true },
      });
      if (products.length !== new Set(productIds).size) {
        throw new Error("INVALID_PRODUCT");
      }

      const variants = await tx.productVariant.findMany({
        where: {
          id: { in: variantIds },
          product: { branchId, isActive: true },
        },
        include: { product: true },
      });
      const variantById = new Map(variants.map((v) => [v.id, v]));

      const invalidVariant = lineItems.some(
        (item) => item.productVariantId && !variantById.has(item.productVariantId),
      );
      if (invalidVariant) {
        throw new Error("INVALID_VARIANT");
      }

      let subtotal = 0;
      const lineData: {
        productId: string;
        productVariantId?: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }[] = [];

      for (const item of lineItems) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) throw new Error("INVALID_PRODUCT");
        const variant = item.productVariantId ? variantById.get(item.productVariantId) : null;
        if (item.productVariantId && (!variant || variant.productId !== product.id)) {
          throw new Error("INVALID_VARIANT");
        }
        const stockRow = variant
          ? await tx.variantStock.findUnique({
              where: { productVariantId_warehouseId: { productVariantId: variant.id, warehouseId } },
            })
          : await tx.productStock.findUnique({
              where: { productId_warehouseId: { productId: product.id, warehouseId } },
            });
        const available = stockRow?.quantity ?? 0;
        if (available < item.quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        const unit = roundMoney2(
          variant?.priceOverride != null ? Number(variant.priceOverride) : Number(product.price),
        );
        const lineTotal = roundMoney2(unit * item.quantity);
        subtotal = roundMoney2(subtotal + lineTotal);
        lineData.push({
          productId: product.id,
          productVariantId: variant?.id ?? undefined,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(toDecimalString(unit)),
          lineTotal: new Prisma.Decimal(toDecimalString(lineTotal)),
        });
      }

      const discountApplied = roundMoney2(Math.min(discount, subtotal));
      const afterDiscount = roundMoney2(subtotal - discountApplied);
      const tax = roundMoney2(afterDiscount * TAX_RATE);
      const total = roundMoney2(afterDiscount + tax);
      const paid = Math.min(paidAmount || total, total);
      const remaining = roundMoney2(total - paid);
      const status = remaining > 0 ? "PENDING" : "COMPLETED";

      if ((paymentMethod === "account" || remaining > 0) && !customerId) {
        throw new Error("CUSTOMER_REQUIRED");
      }

      const branch = await tx.branch.findUniqueOrThrow({
        where: { id: branchId },
        select: { tenantId: true },
      });
      const sale = await tx.transaction.create({
        data: {
          branchId,
          warehouseId,
          userId,
          customerId,
          tenantId: branch.tenantId,
          idempotencyKey: idem ?? undefined,
          subtotal: new Prisma.Decimal(toDecimalString(subtotal)),
          discount: new Prisma.Decimal(toDecimalString(discountApplied)),
          tax: new Prisma.Decimal(toDecimalString(tax)),
          total: new Prisma.Decimal(toDecimalString(total)),
          paidAmount: new Prisma.Decimal(toDecimalString(paid)),
          remainingAmount: new Prisma.Decimal(toDecimalString(remaining)),
          paymentMethod,
          status,
          lineItems: {
            create: lineData.map((l) => ({
              productId: l.productId,
              productVariantId: l.productVariantId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
        select: {
          id: true,
          reference: true,
          subtotal: true,
          discount: true,
          tax: true,
          total: true,
          paymentMethod: true,
          paidAmount: true,
          remainingAmount: true,
          createdAt: true,
        },
      });

      for (const item of lineItems) {
        const variant = item.productVariantId ? variantById.get(item.productVariantId) : null;
        if (variant) {
          const updated = await tx.variantStock.updateMany({
            where: {
              productVariantId: variant.id,
              warehouseId,
              quantity: { gte: item.quantity },
            },
            data: { quantity: { decrement: item.quantity } },
          });
          if (updated.count !== 1) {
            throw new Error("STOCK_RACE");
          }
          await tx.stockMovement.create({
            data: {
              productId: variant.productId,
              productVariantId: variant.id,
              warehouseId,
              type: StockMovementType.SALE,
              quantity: item.quantity,
              transactionId: sale.id,
              createdById: userId,
            },
          });
          await syncProductTotalStock(variant.productId, tx);
        } else {
          const updated = await tx.productStock.updateMany({
            where: {
              productId: item.productId,
              warehouseId,
              quantity: { gte: item.quantity },
            },
            data: { quantity: { decrement: item.quantity } },
          });
          if (updated.count !== 1) {
            throw new Error("STOCK_RACE");
          }
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId,
              type: StockMovementType.SALE,
              quantity: item.quantity,
              transactionId: sale.id,
              createdById: userId,
            },
          });
          await syncProductTotalStock(item.productId, tx);
        }
      }

      if (customerId && remaining > 0) {
        const customer = await tx.customer.update({
          where: { id: customerId },
          data: { paymentBalance: { increment: new Prisma.Decimal(toDecimalString(remaining)) } },
          select: { paymentBalance: true },
        });
        await tx.customerCreditLedger.create({
          data: {
            customerId,
            transactionId: sale.id,
            type: "DEBT",
            amount: new Prisma.Decimal(toDecimalString(remaining)),
            balanceAfter: customer.paymentBalance,
            note: "Sale on account / remaining balance",
          },
        });
      }

      return sale;
    });

    const transaction: SaleResult = {
      id: result.id,
      reference: result.reference,
      subtotal: Number(result.subtotal),
      discount: Number(result.discount),
      tax: Number(result.tax),
      total: Number(result.total),
      paymentMethod: result.paymentMethod,
      createdAt: result.createdAt.toISOString(),
    };

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, name: true },
    });

    await writeAuditLog({
      action: AuditActions.TRANSACTION_CREATE,
      userId,
      entityType: "Transaction",
      entityId: result.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        reference: result.reference,
        total: transaction.total,
        paymentMethod: result.paymentMethod,
        branchId,
        warehouseId,
        idempotencyKey: idem ?? null,
        cashierUsername: actor?.username,
        cashierName: actor?.name,
      },
    });

    return { ok: true, transaction };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INVALID_PRODUCT") return { ok: false, code: "INVALID_PRODUCT" };
    if (msg === "INSUFFICIENT_STOCK") return { ok: false, code: "INSUFFICIENT_STOCK" };
    if (msg === "STOCK_RACE") return { ok: false, code: "STOCK_RACE" };
    throw e;
  }
}
