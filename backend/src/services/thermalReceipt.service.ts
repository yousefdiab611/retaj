/**
 * Thermal Receipt Printer Templates
 * Support for 80mm and 58mm receipt widths
 * RTL Arabic text support
 */

export type PrinterWidth = 80 | 58; // millimeters

export interface ReceiptData {
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  branchName?: string;
  cashierName: string;
  invoiceNumber: string;
  date: string;
  time: string;
  customerName?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod?: string;
  previousBalance?: number;
  totalOutstanding?: number;
  loyaltyPointsEarned?: number;
  qrCode?: string; // Base64 encoded QR code
  notes?: string;
  thankYouMessage: string;
}

/**
 * Generate thermal receipt text for 80mm printer
 */
export function generateThermalReceipt80mm(data: ReceiptData): string {
  const width = 80;
  const charWidth = width; // Approximate characters per line

  return `
${centerText("=".repeat(charWidth), charWidth)}
${centerText(data.storeName, charWidth)}
${data.storeAddress ? centerText(data.storeAddress, charWidth) : ""}
${data.storePhone ? centerText(data.storePhone, charWidth) : ""}
${centerText("-".repeat(charWidth), charWidth)}

${rightAlign("فاتورة / RECEIPT", charWidth)}
${rightAlign(`رقم الفاتورة: ${data.invoiceNumber}`, charWidth)}
${rightAlign(`التاريخ: ${data.date}`, charWidth)}
${rightAlign(`الوقت: ${data.time}`, charWidth)}
${data.branchName ? rightAlign(`الفرع: ${data.branchName}`, charWidth) : ""}
${rightAlign(`الكاشير: ${data.cashierName}`, charWidth)}
${data.customerName ? rightAlign(`العميل: ${data.customerName}`, charWidth) : ""}

${centerText("-".repeat(charWidth), charWidth)}

${rightAlign("الوصف", charWidth - 15)}
${rightAlign("الكمية", charWidth - 40)}
${rightAlign("السعر", charWidth - 60)}

${centerText("-".repeat(charWidth), charWidth)}

${data.items.map((item) => formatReceiptItem(item, charWidth)).join("\n")}

${centerText("-".repeat(charWidth), charWidth)}

${rightAlign("الإجمالي الجزئي", charWidth)}
${leftAlign(formatCurrency(data.subtotal), charWidth)}
${rightAlign("ضريبة القيمة المضافة (15%)", charWidth)}
${leftAlign(formatCurrency(data.tax), charWidth)}
${data.discount && data.discount > 0 ? `${rightAlign("الخصم", charWidth)}\n${leftAlign(formatCurrency(data.discount), charWidth)}` : ""}

${centerText("=".repeat(charWidth), charWidth)}

${rightAlign("الإجمالي", charWidth)}
${leftAlign(formatCurrency(data.total), charWidth)}

${data.paidAmount > 0 ? `${rightAlign("المدفوع", charWidth)}\n${leftAlign(formatCurrency(data.paidAmount), charWidth)}` : ""}

${data.remainingAmount > 0 ? `${rightAlign("المتبقي", charWidth)}\n${leftAlign(formatCurrency(data.remainingAmount), charWidth)}` : ""}

${data.paymentMethod ? rightAlign(`طريقة الدفع: ${data.paymentMethod}`, charWidth) : ""}

${data.previousBalance !== undefined ? `${rightAlign("الرصيد السابق", charWidth)}\n${leftAlign(formatCurrency(data.previousBalance), charWidth)}` : ""}

${data.totalOutstanding !== undefined ? `${rightAlign("الإجمالي المستحق", charWidth)}\n${leftAlign(formatCurrency(data.totalOutstanding), charWidth)}` : ""}

${data.loyaltyPointsEarned && data.loyaltyPointsEarned > 0 ? `${centerText("-".repeat(charWidth), charWidth)}\n${rightAlign("نقاط الولاء المكتسبة", charWidth)}\n${leftAlign(data.loyaltyPointsEarned.toString(), charWidth)}` : ""}

${centerText("=".repeat(charWidth), charWidth)}

${centerText(data.thankYouMessage, charWidth)}

${data.notes ? `\n${centerText(data.notes)}` : ""}

${centerText(new Date().toLocaleString())}

`.trim();
}

/**
 * Generate thermal receipt text for 58mm printer (narrower)
 */
export function generateThermalReceipt58mm(data: ReceiptData): string {
  const width = 58;

  return `
${centerText("=".repeat(width), width)}
${centerText(data.storeName.substring(0, 40), width)}
${data.storePhone ? centerText(data.storePhone) : ""}

${centerText("-".repeat(width), width)}

${rightAlign("الفاتورة", width)}
${rightAlign(`#${data.invoiceNumber}`, width)}
${rightAlign(data.date, width)}
${rightAlign(data.time, width)}
${data.cashierName ? rightAlign(`${data.cashierName}`, width) : ""}

${centerText("-".repeat(width), width)}

${data.items.map((item) => formatReceiptItemNarrow(item, width)).join("\n")}

${centerText("-".repeat(width), width)}

${rightAlign("الإجمالي", width)}
${leftAlign(formatCurrency(data.total), width)}

${data.paidAmount > 0 ? `${rightAlign("المدفوع", width)}\n${leftAlign(formatCurrency(data.paidAmount), width)}` : ""}

${data.remainingAmount > 0 ? `${rightAlign("المتبقي", width)}\n${leftAlign(formatCurrency(data.remainingAmount), width)}` : ""}

${centerText("=".repeat(width), width)}

${centerText(data.thankYouMessage.substring(0, 40), width)}

`.trim();
}

/**
 * Format receipt item with proper spacing
 */
function formatReceiptItem(
  item: { name: string; quantity: number; unitPrice: number; total: number },
  width: number,
): string {
  const nameWidth = width - 25;
  const name = item.name.substring(0, nameWidth);
  const qty = item.quantity.toString().padStart(3);
  const price = formatCurrency(item.total).padStart(12);

  return `${name}${" ".repeat(Math.max(1, nameWidth - name.length))}\n${qty} x ${formatCurrency(item.unitPrice).padStart(8)} = ${price}`;
}

/**
 * Format receipt item for narrow printer
 */
function formatReceiptItemNarrow(
  item: { name: string; quantity: number; unitPrice: number; total: number },
  width: number,
): string {
  const nameWidth = width - 12;
  const name = item.name.substring(0, nameWidth);
  const total = formatCurrency(item.total).padStart(8);

  return `${name}\n${item.quantity}x ${formatCurrency(item.unitPrice)} = ${total}`;
}

/**
 * Center text
 */
function centerText(text: string, width: number = 80): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

/**
 * Right align text (for Arabic RTL support)
 */
function rightAlign(text: string, width: number): string {
  const padding = Math.max(0, width - text.length);
  return " ".repeat(padding) + text;
}

/**
 * Left align text
 */
function leftAlign(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - text.length));
}

/**
 * Format currency for receipt
 */
function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} ر.س`;
}

/**
 * Generate HTML for web-based thermal receipt preview
 */
export function generateThermalReceiptHTML(data: ReceiptData, width: PrinterWidth = 80): string {
  const receiptText = width === 80 ? generateThermalReceipt80mm(data) : generateThermalReceipt58mm(data);

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${data.invoiceNumber}</title>
  <style>
    body {
      margin: 0;
      padding: 10px;
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .receipt {
      background: white;
      padding: 20px;
      width: ${width}mm;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      font-size: 11px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-wrap: break-word;
      direction: rtl;
      text-align: right;
    }
    .receipt-text {
      font-family: 'Courier New', monospace;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
      .receipt {
        width: 100%;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-text">${receiptText}</div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate JSON format for POS system integration
 */
export function generateReceiptJSON(data: ReceiptData) {
  return {
    invoiceNumber: data.invoiceNumber,
    date: data.date,
    time: data.time,
    storeName: data.storeName,
    customerName: data.customerName,
    items: data.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    totals: {
      subtotal: data.subtotal,
      tax: data.tax,
      discount: data.discount || 0,
      total: data.total,
    },
    payment: {
      method: data.paymentMethod,
      paidAmount: data.paidAmount,
      remaining: data.remainingAmount,
    },
    loyalty: {
      pointsEarned: data.loyaltyPointsEarned || 0,
    },
    timestamp: new Date().toISOString(),
  };
}
