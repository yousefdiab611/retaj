import type { InvoiceTransaction } from "@/types/invoice";

import { BRAND_LOGO_FALLBACK_SRC, BRAND_LOGO_PRIMARY_SRC } from "./branding";
import { generateQrCodeDataUrl } from "./qr";

/** Local-only receipt when the server is unavailable (queued for sync). */
export type ThermalOfflineDraft = {
  reference: string;
  createdAt: string;
  storeName: string;
  currency: string;
  thankYou: string;
  cashierLabel: string;
  customer: { name: string; phone: string | null } | null;
  lines: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number, currency: string): string {
  return `${n.toFixed(2)} ${currency}`;
}

/** Opens print dialog with 80mm thermal layout (browser / PDF / thermal driver). */
export function printThermalReceipt(tx: InvoiceTransaction): void {
  const currency = tx.store.currency ?? "SAR";
  const cashierLabel = tx.cashier.username ?? tx.cashier.name;
  const when = new Date(tx.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const cust = tx.customer
    ? `${esc(tx.customer.name)}${tx.customer.phone ? ` · ${esc(tx.customer.phone)}` : ""}`
    : "—";

  const qrDataUrl = generateQrCodeDataUrl(JSON.stringify({
    invoice: tx.reference,
    date: tx.createdAt,
    total: tx.total,
    customer: tx.customer?.name ?? "",
  }));

  const linesHtml = tx.lines
    .map(
      (l) => `
    <tr>
      <td class="name">${esc(l.name)}</td>
      <td style="text-align:center;">${l.quantity}</td>
      <td style="text-align:center;">${money(l.unitPrice, currency)}</td>
      <td style="text-align:left;">${money(l.lineTotal, currency)}</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${esc(tx.reference)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 8px;
      direction: rtl;
      font-family: "Segoe UI", "Tajawal", "Cairo", sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #111;
      max-width: 72mm;
      margin-inline: auto;
    }
    .logo { text-align: center; margin-bottom: 8px; }
    .logo img { max-width: 120px; height: auto; display: inline-block; }
    h1 {
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      margin: 4px 0 2px;
    }
    .subtitle { text-align: center; font-size: 10px; color: #555; margin-bottom: 8px; }
    .meta, .row { margin: 4px 0; font-size: 10px; }
    .label { font-weight: 700; display: inline-block; min-width: 62px; }
    .qr { text-align: center; margin: 10px 0; }
    .qr img { width: 112px; height: 112px; }
    table.lines { width: 100%; border-collapse: collapse; margin: 10px 0; }
    .lines td { padding: 2px 0; vertical-align: top; font-size: 10px; }
    .lines .name { font-weight: 700; padding-top: 4px; }
    .lines .sub td { color: #333; }
    .lines .sub .r { text-align: left; }
    .totals { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; }
    .totals table { width: 100%; border-collapse: collapse; }
    .totals td { padding: 3px 0; font-size: 10px; }
    .totals td:first-child { text-align: right; color: #444; }
    .totals td:last-child { text-align: left; font-weight: 700; }
    .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #333; }
    .footer .small { font-size: 9px; color: #666; margin-top: 3px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="logo"><img src="${esc(BRAND_LOGO_PRIMARY_SRC)}" onerror="this.onerror=null;this.src='${esc(BRAND_LOGO_FALLBACK_SRC)}'" alt="" crossorigin="anonymous" /></div>
  <h1>Retaj Store</h1>
  <p class="subtitle">ريتاج ستور</p>
  <div class="row"><span class="label">رقم الفاتورة</span>${esc(tx.reference)}</div>
  <div class="row"><span class="label">التاريخ</span>${esc(new Date(tx.createdAt).toLocaleDateString("ar-SA"))}</div>
  <div class="row"><span class="label">الوقت</span>${esc(new Date(tx.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }))}</div>
  <div class="row"><span class="label">اسم الكاشير</span>${esc(cashierLabel)}</div>
  <div class="row"><span class="label">العميل</span>${cust}</div>
  <div class="qr"><img src="${esc(qrDataUrl)}" alt="QR code" /></div>
  <table class="lines">
    <thead>
      <tr>
        <td class="name">الصنف</td>
        <td class="name" style="text-align:center;">الكمية</td>
        <td class="name" style="text-align:center;">السعر</td>
        <td class="name">الإجمالي</td>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>
  <div class="totals">
    <table>
      <tr><td>الإجمالي الفرعي</td><td>${money(tx.subtotal, currency)}</td></tr>
      ${tx.discount > 0 ? `<tr><td>الخصم</td><td>-${money(tx.discount, currency)}</td></tr>` : ""}
      <tr><td>إجمالي الفاتورة</td><td>${money(tx.total, currency)}</td></tr>
      <tr><td>المدفوع</td><td>${money(tx.paid, currency)}</td></tr>
      <tr><td>المتبقي</td><td>${money(tx.remaining, currency)}</td></tr>
    </table>
  </div>
  <div class="footer">
    <p>شكراً لتعاملك معنا</p>
    <p class="small">نتمنى لكم يوماً سعيداً</p>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 200);
}

export function printThermalReceiptOffline(draft: ThermalOfflineDraft): void {
  const currency = draft.currency ?? "SAR";
  const cashierLabel = draft.cashierLabel;
  const when = new Date(draft.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const cust = draft.customer
    ? `${esc(draft.customer.name)}${draft.customer.phone ? ` · ${esc(draft.customer.phone)}` : ""}`
    : "—";

  const linesHtml = draft.lines
    .map(
      (l) => `
    <tr>
      <td colspan="2" class="name">${esc(l.name)}</td>
    </tr>
    <tr class="sub">
      <td>${l.quantity} × ${money(l.unitPrice, currency)}</td>
      <td class="r">${money(l.lineTotal, currency)}</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${esc(draft.reference)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 8px;
      direction: rtl;
      font-family: "Segoe UI", "Tajawal", "Cairo", sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #111;
      max-width: 72mm;
      margin-inline: auto;
    }
    .logo { text-align: center; margin-bottom: 8px; }
    .logo img { max-width: 140px; height: auto; display: inline-block; }
    h1 {
      font-size: 14px;
      font-weight: 700;
      text-align: center;
      margin: 0 0 6px;
      letter-spacing: 0.02em;
    }
    .meta, .row { margin: 4px 0; }
    .muted { color: #444; font-size: 10px; }
    .pending { text-align: center; font-size: 10px; color: #666; margin: 4px 0; }
    .label { font-weight: 700; display: inline-block; min-width: 80px; }
    table.lines { width: 100%; border-collapse: collapse; margin: 10px 0; }
    .lines td { padding: 2px 0; vertical-align: top; }
    .lines .name { font-weight: 600; padding-top: 4px; }
    .lines .sub td { font-size: 10px; color: #333; }
    .lines .sub .r { text-align: left; }
    .totals { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; }
    .totals table { width: 100%; border-collapse: collapse; }
    .totals td { padding: 3px 0; }
    .totals td:first-child { text-align: right; color: #444; }
    .totals td:last-child { text-align: left; font-weight: 700; }
    .thanks { text-align: center; margin-top: 12px; font-size: 10px; color: #333; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="logo"><img src="${esc(BRAND_LOGO_PRIMARY_SRC)}" onerror="this.onerror=null;this.src='${esc(BRAND_LOGO_FALLBACK_SRC)}'" alt="" crossorigin="anonymous" /></div>
  <h1>${esc(draft.storeName)}</h1>
  <p class="pending">غير متصل ــ جاري الطباعة عند الاتصال</p>
  <div class="meta"><span class="label">العميل</span>${cust}</div>
  <div class="row"><span class="label">رقم الفاتورة</span>${esc(draft.reference)}</div>
  <div class="row muted">${esc(when)}</div>
  <div class="row"><span class="label">المحاسب</span>${esc(cashierLabel)}</div>
  <table class="lines">
    <tbody>${linesHtml}</tbody>
  </table>
  <div class="totals">
    <table>
      <tr><td>الإجمالي الفرعي</td><td>${money(draft.subtotal, currency)}</td></tr>
      ${draft.discount > 0 ? `<tr><td>الخصم</td><td>-${money(draft.discount, currency)}</td></tr>` : ""}
      <tr><td><strong>المجموع</strong></td><td><strong>${money(draft.total, currency)}</strong></td></tr>
      <tr><td>المدفوع</td><td>${money(draft.paid, currency)}</td></tr>
      <tr><td>المتبقي</td><td>${money(draft.remaining, currency)}</td></tr>
    </table>
  </div>
  <p class="thanks">${esc(draft.thankYou)}</p>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 200);
}
