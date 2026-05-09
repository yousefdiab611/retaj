export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
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
