import { describe, expect, it } from "vitest";

import { formatCurrency, roundMoney2, toDecimalString } from "@/lib/money";

describe("money helpers", () => {
  describe("roundMoney2", () => {
    it("rounds to 2 decimals using banker-friendly nearest", () => {
      expect(roundMoney2(1.005)).toBe(1.01);
      expect(roundMoney2(1.004)).toBe(1.0);
      expect(roundMoney2(2.345)).toBeCloseTo(2.35, 2);
    });

    it("preserves integers and zero", () => {
      expect(roundMoney2(0)).toBe(0);
      expect(roundMoney2(42)).toBe(42);
    });

    it("handles negative amounts", () => {
      expect(roundMoney2(-1.005)).toBeCloseTo(-1.0, 2);
      expect(roundMoney2(-99.999)).toBe(-100);
    });
  });

  describe("toDecimalString", () => {
    it("always emits two decimal places", () => {
      expect(toDecimalString(0)).toBe("0.00");
      expect(toDecimalString(1.5)).toBe("1.50");
      expect(toDecimalString(1.005)).toBe("1.01");
    });
  });

  describe("formatCurrency", () => {
    it("appends the default currency", () => {
      expect(formatCurrency(125)).toBe("125.00 SAR");
    });

    it("respects a provided currency code", () => {
      expect(formatCurrency(7.5, "USD")).toBe("7.50 USD");
    });
  });
});
