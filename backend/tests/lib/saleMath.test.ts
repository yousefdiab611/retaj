import { describe, expect, it } from "vitest";

import { computeSaleTotals } from "@/lib/saleMath";

describe("computeSaleTotals", () => {
  it("computes a simple cash sale fully paid", () => {
    const totals = computeSaleTotals({
      lines: [{ quantity: 2, unitPrice: 50 }],
      taxRate: 0.15,
    });
    expect(totals.subtotal).toBe(100);
    expect(totals.discount).toBe(0);
    expect(totals.tax).toBeCloseTo(15, 2);
    expect(totals.total).toBeCloseTo(115, 2);
    expect(totals.paid).toBeCloseTo(115, 2);
    expect(totals.remaining).toBe(0);
    expect(totals.status).toBe("COMPLETED");
  });

  it("clamps an over-large discount to the subtotal", () => {
    const totals = computeSaleTotals({
      lines: [{ quantity: 1, unitPrice: 100 }],
      discount: 500,
      taxRate: 0.15,
    });
    expect(totals.discount).toBe(100);
    expect(totals.taxableBase).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("treats partial payment as a credit sale", () => {
    const totals = computeSaleTotals({
      lines: [
        { quantity: 1, unitPrice: 200 },
        { quantity: 3, unitPrice: 50 },
      ],
      paidAmount: 100,
      taxRate: 0.15,
    });
    expect(totals.subtotal).toBe(350);
    expect(totals.tax).toBeCloseTo(52.5, 2);
    expect(totals.total).toBeCloseTo(402.5, 2);
    expect(totals.paid).toBe(100);
    expect(totals.remaining).toBeCloseTo(302.5, 2);
    expect(totals.status).toBe("PENDING");
  });

  it("never lets remaining go below zero when overpaying", () => {
    const totals = computeSaleTotals({
      lines: [{ quantity: 1, unitPrice: 100 }],
      paidAmount: 9999,
      taxRate: 0.15,
    });
    expect(totals.remaining).toBe(0);
    expect(totals.paid).toBeCloseTo(115, 2);
    expect(totals.status).toBe("COMPLETED");
  });

  it("rejects negative quantities, prices, discounts and payments", () => {
    expect(() => computeSaleTotals({ lines: [{ quantity: -1, unitPrice: 10 }], taxRate: 0.15 })).toThrow(
      /quantity/,
    );
    expect(() => computeSaleTotals({ lines: [{ quantity: 1, unitPrice: -5 }], taxRate: 0.15 })).toThrow(
      /unit_price/,
    );
    expect(() =>
      computeSaleTotals({
        lines: [{ quantity: 1, unitPrice: 100 }],
        discount: -10,
        taxRate: 0.15,
      }),
    ).toThrow(/discount/);
    expect(() =>
      computeSaleTotals({
        lines: [{ quantity: 1, unitPrice: 100 }],
        paidAmount: -1,
        taxRate: 0.15,
      }),
    ).toThrow(/paid_amount/);
  });

  it("handles a zero-tax jurisdiction", () => {
    const totals = computeSaleTotals({
      lines: [{ quantity: 4, unitPrice: 25 }],
      taxRate: 0,
    });
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(100);
  });
});
