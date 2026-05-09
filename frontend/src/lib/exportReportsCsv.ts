import type { ReportSummary, ReportTransactionRow } from "@/lib/api";

import { csvField, downloadTextFile } from "./csv";

export function downloadReportTransactionsCsv(
  rows: ReportTransactionRow[],
  summary: ReportSummary["summary"] | null,
  fromLabel: string,
  toLabel: string,
): void {
  const lines: string[] = [];
  if (summary) {
    const row = (a: string, b: string) => [csvField(a), csvField(b)].join(",");
    lines.push(row("section", "value"));
    lines.push(row("period_from", fromLabel));
    lines.push(row("period_to", toLabel));
    lines.push(row("transaction_count", String(summary.transactionCount)));
    lines.push(row("revenue", String(summary.revenue)));
    lines.push(row("tax", String(summary.tax)));
    lines.push(row("discount", String(summary.discount)));
    lines.push(row("subtotal", String(summary.subtotal)));
    lines.push("");
  }

  const headers = [
    "reference",
    "created_at",
    "cashier",
    "customer",
    "payment",
    "subtotal",
    "tax",
    "discount",
    "total",
  ];
  lines.push(headers.map(csvField).join(","));

  for (const r of rows) {
    lines.push(
      [
        r.reference,
        r.createdAt,
        r.user.name,
        r.customer?.name ?? "",
        r.paymentMethod ?? "",
        String(r.subtotal),
        String(r.tax),
        String(r.discount),
        String(r.total),
      ]
        .map(csvField)
        .join(","),
    );
  }

  const safeFrom = fromLabel.replaceAll(/[^\d-]/g, "");
  const safeTo = toLabel.replaceAll(/[^\d-]/g, "");
  downloadTextFile(`sales_${safeFrom}_${safeTo}.csv`, lines.join("\n"));
}
