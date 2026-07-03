import fs from "fs";
import path from "path";

import PDFDocument from "pdfkit";

import { formatArabicDate, formatCurrency } from "../lib/money";
import { prisma } from "../lib/prisma";

export interface InvoiceForPDF {
  id: string;
  number: string;
  invoiceTotal: number;
  paidAmount: number;
  remainingAmount: number;
  previousBalance: number;
  totalOutstanding: number;
  subtotal: number;
  tax: number;
  discount: number;
  customerName: string;
  customerPhone?: string | null;
  lastPaymentDate?: Date | null;
  previousInvoiceCount: number;
  loyaltyPointsEarned: number;
  loyaltyPointsBefore: number;
  loyaltyPointsAfter: number;
  paymentMethod?: string | null;
  currency: string;
  status: string;
  dueDate: Date;
  paidAt?: Date | null;
  qrCodeUrl?: string | null;
  createdAt: Date;
  tenant: {
    name: string;
    storeAddress?: string | null;
    storePhone?: string | null;
    invoiceLogoUrl?: string | null;
    invoiceThankYou: string;
    invoiceFooterNote?: string | null;
    invoicePrimaryColor?: string | null;
    invoiceSecondaryColor?: string | null;
  };
}

/**
 * Generate professional PDF invoice with RTL Arabic support
 */
export async function generateInvoicePDF(invoice: InvoiceForPDF, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document with Arabic support
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      // Pipe to file
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const primaryColor = invoice.tenant.invoicePrimaryColor || "#1F2937";
      // Header with logo
      if (invoice.tenant.invoiceLogoUrl) {
        try {
          // Download logo if URL, otherwise assume local path
          doc.image(invoice.tenant.invoiceLogoUrl, { width: 80, height: 80 });
        } catch {
          // Logo not available, skip
        }
      }

      // Store name and info (RTL text needs special handling)
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text(invoice.tenant.name || "الفاتورة", {
          align: "right",
        });

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(invoice.tenant.storeAddress || "", {
          align: "right",
        });
      if (invoice.tenant.storePhone) {
        doc.text(`رقم الهاتف: ${invoice.tenant.storePhone}`, { align: "right" });
      }

      doc
        .moveTo(40, doc.y + 10)
        .lineTo(550, doc.y + 10)
        .stroke();
      doc.moveDown();

      // Invoice title and number
      doc.fontSize(16).font("Helvetica-Bold").text("الفاتورة / INVOICE", {
        align: "center",
      });
      doc.fontSize(12).text(`رقم الفاتورة: ${invoice.number}`, { align: "center" });
      doc.fontSize(10).text(`التاريخ: ${formatArabicDate(invoice.createdAt)}`, {
        align: "center",
      });

      doc.moveDown();

      // Customer info box
      doc.rect(40, doc.y, 510, 80).stroke(primaryColor);
      doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke(primaryColor);

      doc.fontSize(11).font("Helvetica-Bold").text(`اسم العميل: ${invoice.customerName}`, {
        align: "right",
      });
      if (invoice.customerPhone) {
        doc.fontSize(10).text(`رقم الهاتف: ${invoice.customerPhone}`, { align: "right" });
      }
      doc
        .fontSize(10)
        .text(
          `آخر سداد: ${invoice.lastPaymentDate ? formatArabicDate(invoice.lastPaymentDate) : "لا يوجد"}`,
          { align: "right" },
        );
      doc.fontSize(10).text(`عدد الفواتير: ${invoice.previousInvoiceCount}`, { align: "right" });
      doc.moveDown();

      // Payment details table
      doc.fontSize(11).font("Helvetica-Bold").text("تفاصيل الدفع", { align: "right" });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const tableData = [
        { label: "الإجمالي", value: formatCurrency(invoice.invoiceTotal, "SAR"), arabicLabel: true },
        { label: "المدفوع", value: formatCurrency(invoice.paidAmount, "SAR"), arabicLabel: true },
        { label: "المتبقي", value: formatCurrency(invoice.remainingAmount, "SAR"), arabicLabel: true },
        { label: "الرصيد السابق", value: formatCurrency(invoice.previousBalance, "SAR"), arabicLabel: true },
        {
          label: "الإجمالي المستحق",
          value: formatCurrency(invoice.totalOutstanding, "SAR"),
          highlight: true,
          arabicLabel: true,
        },
      ];

      // Draw table
      tableData.forEach((row, index) => {
        const yPos = tableTop + index * 20;
        const color = row.highlight ? primaryColor : "#000000";
        const weight = row.highlight ? "bold" : "normal";

        doc.fontSize(10).font(`Helvetica-${weight}`).fillColor(color);
        doc.text(row.label, 320, yPos, { width: 150, align: "right" });
        doc.text(row.value, 50, yPos, { width: 150, align: "left" });
      });

      doc.moveDown(6);

      // Loyalty points section (if earned)
      if (invoice.loyaltyPointsEarned > 0) {
        doc.fontSize(11).font("Helvetica-Bold").text("نقاط الولاء", { align: "right" });
        doc.moveDown(0.5);

        const loyaltyBox = [
          {
            label: "نقاط مكتسبة",
            value: invoice.loyaltyPointsEarned.toString(),
          },
          {
            label: "إجمالي النقاط",
            value: invoice.loyaltyPointsAfter.toString(),
          },
        ];

        loyaltyBox.forEach((row) => {
          doc.fontSize(10).text(row.label, 320, doc.y, { width: 150, align: "right" });
          doc.text(row.value, 50, doc.y, { width: 150, align: "left" });
        });

        doc.moveDown();
      }

      // QR Code (if available)
      if (invoice.qrCodeUrl) {
        doc.moveDown();
        doc.fontSize(10).text("QR Code", { align: "center" });
        try {
          const qrBuffer = Buffer.from(invoice.qrCodeUrl.split(",")[1], "base64");
          doc.image(qrBuffer, { width: 100, height: 100, align: "center" });
        } catch {
          // QR code not available
        }
      }

      doc.moveDown();

      // Status footer
      const statusText =
        invoice.status === "PAID"
          ? "تم السداد بالكامل ✓"
          : invoice.status === "PARTIALLY_PAID"
            ? "تم السداد جزئياً"
            : "قيد الانتظار";

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor(invoice.status === "PAID" ? "#10B981" : primaryColor)
        .text(statusText, { align: "center" });

      // Thank you message
      doc.moveDown();
      doc.fontSize(11).fillColor("#000000").text(invoice.tenant.invoiceThankYou, {
        align: "right",
      });

      // Footer note
      if (invoice.tenant.invoiceFooterNote) {
        doc.fontSize(9).fillColor("#666666").text(invoice.tenant.invoiceFooterNote, {
          align: "center",
        });
      }

      // Page number
      doc
        .fontSize(8)
        .fillColor("#999999")
        .text(`Generated: ${new Date().toLocaleString()}`, 40, doc.page.height - 30, {
          align: "center",
        });

      // Finalize PDF
      doc.end();

      stream.on("finish", () => {
        resolve(outputPath);
      });

      stream.on("error", (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Save invoice PDF and update database
 */
export async function saveInvoicePDF(invoiceId: string, pdfPath: string): Promise<void> {
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      pdfPath,
    },
  });
}

/**
 * Get PDF output directory for invoices
 */
export function getInvoicePDFPath(tenantId: string, invoiceNumber: string): string {
  const dir = path.join(process.cwd(), "invoices", tenantId);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return path.join(dir, `invoice-${invoiceNumber}.pdf`);
}

/**
 * Format date in Arabic format
 */
