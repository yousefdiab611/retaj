import { prisma } from "../lib/prisma";

import type { UserRole } from "@prisma/client";

export async function getTransactionForInvoice(
  transactionId: string,
  requesterUserId: string,
  requesterRole: UserRole,
  requesterBranchId: string | null,
  requesterTenantId: string,
) {
  const baseCondition: Record<string, unknown> = {
    id: transactionId,
    tenantId: requesterTenantId,
  };
  const where =
    requesterRole === "CASHIER"
      ? {
          ...baseCondition,
          userId: requesterUserId,
          branchId: requesterBranchId ?? undefined,
        }
      : baseCondition;

  const row = await prisma.transaction.findFirst({
    where,
    include: {
      branch: { select: { id: true, name: true, address: true, phone: true } },
      warehouse: { select: { id: true, name: true, location: true } },
      lineItems: {
        include: {
          product: { select: { id: true, sku: true, name: true, barcode: true } },
          productVariant: {
            select: { id: true, sku: true, barcode: true, size: true, color: true, priceOverride: true },
          },
        },
        orderBy: { id: "asc" },
      },
      customer: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true, username: true } },
    },
  });

  if (!row) {
    return null;
  }

  const subtotal = Number(row.subtotal);
  const discount = Number(row.discount);
  const tax = Number(row.tax);
  const total = Number(row.total);
  const paid = Number(row.paidAmount ?? 0);
  const remaining = Number(row.remainingAmount ?? 0);

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    paymentMethod: row.paymentMethod,
    subtotal,
    discount,
    tax,
    total,
    paid,
    remaining,
    branch: {
      id: row.branch.id,
      name: row.branch.name,
      address: row.branch.address,
      phone: row.branch.phone,
    },
    warehouse: {
      id: row.warehouse.id,
      name: row.warehouse.name,
      location: row.warehouse.location,
    },
    store: {
      name: process.env.STORE_NAME ?? "RETAJ STORE",
      currency: process.env.STORE_CURRENCY ?? "SAR",
      taxLabel: process.env.STORE_TAX_LABEL ?? "VAT (15%)",
      thankYou: process.env.STORE_THANK_YOU ?? "Thank you for shopping with us.",
    },
    cashier: {
      id: row.user.id,
      username: row.user.username,
      name: row.user.name,
      email: row.user.email,
    },
    customer: row.customer
      ? {
          id: row.customer.id,
          name: row.customer.name,
        }
      : null,
    lines: row.lineItems.map((l) => ({
      id: l.id,
      productId: l.productId,
      sku: l.productVariant?.sku ?? l.product.sku,
      name:
        l.productVariant?.size || l.productVariant?.color
          ? `${l.product.name} ${[l.productVariant?.size, l.productVariant?.color].filter(Boolean).join(" /")}`
          : l.product.name,
      barcode: l.productVariant?.barcode ?? l.product.barcode,
      quantity: l.quantity,
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    })),
  };
}
