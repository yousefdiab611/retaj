import { roundMoney2 } from "./money";

export interface SaleLineInput {
  quantity: number;
  unitPrice: number;
}

export interface SaleTotals {
  subtotal: number;
  discount: number;
  taxableBase: number;
  tax: number;
  total: number;
  paid: number;
  remaining: number;
  status: "PENDING" | "COMPLETED";
}

/**
 * Pure helper that computes the canonical sale totals. Extracted so the
 * pricing engine is unit-testable without spinning up Prisma.
 */
export function computeSaleTotals(params: {
  lines: SaleLineInput[];
  discount?: number;
  paidAmount?: number;
  taxRate: number;
}): SaleTotals {
  const subtotal = roundMoney2(
    params.lines.reduce((acc, line) => {
      if (line.quantity < 0) {
        throw new RangeError("quantity_must_be_positive");
      }
      if (line.unitPrice < 0) {
        throw new RangeError("unit_price_must_be_positive");
      }
      return acc + line.quantity * line.unitPrice;
    }, 0),
  );

  const requestedDiscount = roundMoney2(params.discount ?? 0);
  if (requestedDiscount < 0) {
    throw new RangeError("discount_must_be_positive");
  }
  const discount = roundMoney2(Math.min(requestedDiscount, subtotal));
  const taxableBase = roundMoney2(subtotal - discount);
  const tax = roundMoney2(taxableBase * params.taxRate);
  const total = roundMoney2(taxableBase + tax);

  const requestedPaid = roundMoney2(params.paidAmount ?? 0);
  if (requestedPaid < 0) {
    throw new RangeError("paid_amount_must_be_positive");
  }
  const paid = roundMoney2(Math.min(requestedPaid || total, total));
  const remaining = roundMoney2(total - paid);
  const status = remaining > 0 ? "PENDING" : "COMPLETED";

  return { subtotal, discount, taxableBase, tax, total, paid, remaining, status };
}
