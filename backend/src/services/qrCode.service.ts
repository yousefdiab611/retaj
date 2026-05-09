import QRCode from "qrcode";
import { prisma } from "../lib/prisma";

export interface QRCodeData {
  invoiceNumber: string;
  total: number;
  date: string;
  customerName: string;
  verificationUrl?: string;
}

/**
 * Generate QR code data/image for invoice
 * QR code contains: invoice number, total, date, customer name, verification URL
 */
export async function generateInvoiceQRCode(
  invoiceId: string,
  data: QRCodeData,
  format: "dataurl" | "buffer" = "dataurl",
): Promise<string | Buffer> {
  // Format QR code content
  const qrContent = JSON.stringify({
    type: "invoice",
    invoiceNumber: data.invoiceNumber,
    total: data.total,
    date: data.date,
    customerName: data.customerName,
    verificationUrl: data.verificationUrl,
    timestamp: new Date().toISOString(),
  });

  try {
    let qrCode: string | Buffer;

    if (format === "dataurl") {
      qrCode = await QRCode.toDataURL(qrContent, {
        width: 200,
        margin: 2,
        color: {
          dark: "#1F2937", // Dark gray
          light: "#FFFFFF", // White
        },
      });
    } else {
      qrCode = await QRCode.toBuffer(qrContent, {
        width: 200,
        margin: 2,
        type: "png",
      });
    }

    // Store QR code data in invoice
    if (format === "dataurl") {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          qrCodeUrl: qrCode as string,
          qrCodeData: qrContent,
        },
      });
    }

    return qrCode;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code for invoice");
  }
}

/**
 * Generate QR code for thermal receipt (optimized for small size)
 */
export async function generateThermalReceiptQRCode(data: QRCodeData): Promise<string> {
  const qrContent = JSON.stringify({
    inv: data.invoiceNumber,
    amt: data.total,
    dt: data.date,
    cust: data.customerName,
  });

  try {
    return await QRCode.toDataURL(qrContent, {
      width: 100, // Smaller for thermal receipt
      margin: 1,
      errorCorrectionLevel: "M",
      type: "image/png",
    });
  } catch (error) {
    console.error("Error generating thermal QR code:", error);
    throw new Error("Failed to generate thermal QR code");
  }
}

/**
 * Verify QR code data (for customer verification)
 */
export function parseQRCodeData(
  qrContent: string,
): QRCodeData | null {
  try {
    const data = JSON.parse(qrContent);
    if (data.type === "invoice") {
      return {
        invoiceNumber: data.invoiceNumber,
        total: data.total,
        date: data.date,
        customerName: data.customerName,
        verificationUrl: data.verificationUrl,
      };
    }
    return null;
  } catch {
    return null;
  }
}
