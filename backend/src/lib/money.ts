export function roundMoney2(n: number): number {
  // IEEE-754 binary representation means values like 1.005 are stored as
  // 1.00499999..., so a naive Math.round(n * 100) silently truncates a
  // halalala from every receipt. We absorb that ULP error by re-scaling
  // through an intermediate higher-precision rounding step before the
  // final 2-decimal round.
  if (!Number.isFinite(n) || n === 0) return 0;
  const sign = n < 0 ? -1 : 1;
  const scaled = Math.round(Math.abs(n) * 1e10) / 1e8;
  return (sign * Math.round(scaled)) / 100;
}

export function toDecimalString(n: number): string {
  return roundMoney2(n).toFixed(2);
}

export function formatCurrency(amount: number, currency: string = "SAR"): string {
  return `${roundMoney2(amount).toFixed(2)} ${currency}`;
}

export function formatArabicDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return formatter.format(date);
}
