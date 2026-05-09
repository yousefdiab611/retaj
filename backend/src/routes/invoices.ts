import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import {
  createOrUpdateInvoice,
  getInvoiceWithDetails,
  generateInvoiceNumber,
  recordLoyaltyPoints,
  updateCustomerBalance,
  getCustomerRecentTransactions,
} from "../services/invoiceEnterprise.service";
import { generateInvoiceQRCode, generateThermalReceiptQRCode } from "../services/qrCode.service";
import { generateInvoicePDF, getInvoicePDFPath, saveInvoicePDF } from "../services/pdfInvoice.service";
import {
  generateThermalReceipt80mm,
  generateThermalReceipt58mm,
  generateThermalReceiptHTML,
  generateReceiptJSON,
  type ReceiptData,
} from "../services/thermalReceipt.service";
import { prisma } from "../lib/prisma";
import { writeAuditLog } from "../services/audit.service";
import type { UserRole } from "@prisma/client";

const invoiceRouter = Router();

// ============ SCHEMAS ============

const createInvoiceSchema = z.object({
  customerId: z.string().cuid(),
  invoiceTotal: z.number().positive(),
  paidAmount: z.number().min(0),
  subtotal: z.number().positive(),
  tax: z.number().min(0),
  discount: z.number().min(0),
  paymentMethod: z.string().optional(),
  dueDate: z.string().datetime(),
  notes: z.string().optional(),
});

const generatePDFSchema = z.object({
  invoiceId: z.string().cuid(),
});

const generateReceiptSchema = z.object({
  invoiceId: z.string().cuid(),
  width: z.enum(["80", "58"]).optional(),
  format: z.enum(["text", "html", "json"]).optional(),
});

const generateQRCodeSchema = z.object({
  invoiceId: z.string().cuid(),
});

const updateInvoicePaymentSchema = z.object({
  invoiceId: z.string().cuid(),
  paidAmount: z.number().min(0),
  paymentMethod: z.string().optional(),
});

// ============ ROUTES ============

/**
 * Create a new invoice with all calculated fields
 * POST /api/invoices
 */
invoiceRouter.post("/", requireAuth, requireRole("TENANT_ADMIN", "ADMIN", "ACCOUNTANT"), async (req: Request, res: Response) => {
  try {
    const parsed = createInvoiceSchema.parse(req.body);
    const userId = req.userId;
    const tenantId = req.userTenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: { id: parsed.customerId, tenantId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Create invoice with all calculated fields
    const invoice = await createOrUpdateInvoice(tenantId, parsed.customerId, {
      invoiceTotal: parsed.invoiceTotal,
      paidAmount: parsed.paidAmount,
      subtotal: parsed.subtotal,
      tax: parsed.tax,
      discount: parsed.discount,
      paymentMethod: parsed.paymentMethod,
      dueDate: new Date(parsed.dueDate),
      notes: parsed.notes,
    });

    // Record loyalty points if earned
    if (invoice.loyaltyPointsEarned > 0) {
      await recordLoyaltyPoints(
        tenantId,
        parsed.customerId,
        invoice.loyaltyPointsEarned,
        invoice.id,
        "EARNED",
        "Invoice purchase",
      );
    }

    // Audit log
    await writeAuditLog({
      tenantId,
      branchId: req.userBranchId ?? null,
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      entityId: invoice.id,
      userId,
      metadata: {
        customerName: customer.name,
        total: parsed.invoiceTotal,
      },
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

/**
 * Get invoice with all details
 * GET /api/invoices/:invoiceId
 */
invoiceRouter.get("/:invoiceId", requireAuth, async (req: Request, res: Response) => {
  try {
    const invoiceId = String(req.params.invoiceId);
    const tenantId = req.userTenantId;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const invoice = await getInvoiceWithDetails(invoiceId);

    if (!invoice || invoice.tenantId !== tenantId) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

/**
 * List invoices with filters
 * GET /api/invoices
 */
invoiceRouter.get(
  "/",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.userTenantId;
      const { customerId, status, skip = "0", take = "20" } = req.query;

      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const where: any = { tenantId };
      if (customerId) where.customerId = customerId;
      if (status) where.status = status;

      const invoices = await prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: parseInt(skip as string),
        take: parseInt(take as string),
        include: { customer: { select: { name: true } } },
      });

      const total = await prisma.invoice.count({ where });

      res.json({ invoices, total });
    } catch (error) {
      console.error("Error listing invoices:", error);
      res.status(500).json({ error: "Failed to list invoices" });
    }
  },
);

/**
 * Generate PDF invoice
 * POST /api/invoices/:invoiceId/pdf
 */
invoiceRouter.post(
  "/:invoiceId/pdf",
  requireAuth,
  requireRole("TENANT_ADMIN", "ADMIN", "ACCOUNTANT"),
  async (req: Request, res: Response) => {
    try {
      const invoiceId = String(req.params.invoiceId);
      const tenantId = req.userTenantId;
      const userId = req.userId;

      if (!tenantId || !userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const invoice = await getInvoiceWithDetails(invoiceId);

      if (!invoice || invoice.tenantId !== tenantId) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Generate QR code first
      if (!invoice.qrCodeUrl) {
        await generateInvoiceQRCode(invoiceId, {
          invoiceNumber: invoice.number,
          total: invoice.invoiceTotal,
          date: invoice.createdAt.toISOString(),
          customerName: invoice.customerName,
        });
      }

      // Generate PDF
      const pdfPath = getInvoicePDFPath(tenantId, invoice.number);
      await generateInvoicePDF(invoice as any, pdfPath);
      await saveInvoicePDF(invoiceId, pdfPath);

      // Audit log
      await writeAuditLog({
        tenantId,
        branchId: req.userBranchId ?? null,
        action: "INVOICE_PDF_GENERATED",
        entityType: "Invoice",
        entityId: invoiceId,
        userId,
      });

      res.json({ pdfPath, url: `/invoices/${tenantId}/${invoice.number}.pdf` });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  },
);

/**
 * Generate thermal receipt
 * POST /api/invoices/:invoiceId/receipt
 */
invoiceRouter.post(
  "/:invoiceId/receipt",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const invoiceId = String(req.params.invoiceId);
      const { width = "80", format = "html" } = req.body;
      const tenantId = req.userTenantId;

      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const invoice = await getInvoiceWithDetails(invoiceId);

      if (!invoice || invoice.tenantId !== tenantId) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Build receipt data
      const receiptData: ReceiptData = {
        storeName: invoice.tenant.name,
        storePhone: invoice.tenant.storePhone ?? undefined,
        storeAddress: invoice.tenant.storeAddress ?? undefined,
        cashierName: "POS System",
        invoiceNumber: invoice.number,
        date: invoice.createdAt.toLocaleDateString("ar-SA"),
        time: invoice.createdAt.toLocaleTimeString("ar-SA"),
        customerName: invoice.customerName,
        items: [], // Populate from transaction lines if needed
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        discount: invoice.discount,
        total: invoice.invoiceTotal,
        paidAmount: invoice.paidAmount,
        remainingAmount: invoice.remainingAmount,
        paymentMethod: invoice.paymentMethod ?? undefined,
        previousBalance: invoice.previousBalance,
        totalOutstanding: invoice.totalOutstanding,
        loyaltyPointsEarned: invoice.loyaltyPointsEarned,
        thankYouMessage: invoice.tenant.invoiceThankYou,
      };

      let result: any;

      if (format === "html") {
        result = generateThermalReceiptHTML(receiptData, parseInt(width) as 80 | 58);
        res.setHeader("Content-Type", "text/html");
        res.send(result);
      } else if (format === "json") {
        result = generateReceiptJSON(receiptData);
        res.json(result);
      } else {
        // Text format
        result =
          parseInt(width) === 80 ? generateThermalReceipt80mm(receiptData) : generateThermalReceipt58mm(receiptData);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.send(result);
      }
    } catch (error) {
      console.error("Error generating receipt:", error);
      res.status(500).json({ error: "Failed to generate receipt" });
    }
  },
);

/**
 * Generate QR code
 * POST /api/invoices/:invoiceId/qrcode
 */
invoiceRouter.post(
  "/:invoiceId/qrcode",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const invoiceId = String(req.params.invoiceId);
      const tenantId = req.userTenantId;

      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const invoice = await getInvoiceWithDetails(invoiceId);

      if (!invoice || invoice.tenantId !== tenantId) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const qrCode = await generateInvoiceQRCode(invoiceId, {
        invoiceNumber: invoice.number,
        total: invoice.invoiceTotal,
        date: invoice.createdAt.toISOString(),
        customerName: invoice.customerName,
      });

      res.json({ qrCode });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  },
);

/**
 * Update invoice payment
 * PATCH /api/invoices/:invoiceId/payment
 */
invoiceRouter.patch(
  "/:invoiceId/payment",
  requireAuth,
  requireRole("TENANT_ADMIN", "ADMIN", "ACCOUNTANT"),
  async (req: Request, res: Response) => {
    try {
      const invoiceId = String(req.params.invoiceId);
      const parsed = updateInvoicePaymentSchema.parse(req.body);
      const tenantId = req.userTenantId;
      const userId = req.userId;

      if (!tenantId || !userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, tenantId },
      });

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Update payment amount
      const newRemainingAmount = Math.max(
        0,
        Number(invoice.invoiceTotal) - parsed.paidAmount,
      );

      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: parsed.paidAmount,
          remainingAmount: newRemainingAmount,
          paymentMethod: parsed.paymentMethod,
          status: newRemainingAmount === 0 ? "PAID" : "PARTIALLY_PAID",
          paidAt: parsed.paidAmount > 0 ? new Date() : null,
          paidFullyAt: newRemainingAmount === 0 ? new Date() : null,
          isFullyPaid: newRemainingAmount === 0,
        },
      });

      // Update customer balance
      if (parsed.paidAmount > 0) {
        const newCustomerBalance = Math.max(
          0,
          Number(invoice.previousBalance) - parsed.paidAmount,
        );
        await updateCustomerBalance(invoice.customerId, newCustomerBalance, invoiceId, "Payment received");
      }

      // Audit log
      await writeAuditLog({
        tenantId,
        branchId: req.userBranchId ?? null,
        action: "INVOICE_PAYMENT_RECORDED",
        entityType: "Invoice",
        entityId: invoiceId,
        userId,
        metadata: {
          paidAmount: parsed.paidAmount,
          method: parsed.paymentMethod,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating invoice payment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update invoice payment" });
    }
  },
);

/**
 * Get customer account statement (last 5 transactions)
 * GET /api/invoices/:customerId/statement
 */
invoiceRouter.get(
  "/:customerId/statement",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const customerId = String(req.params.customerId);
      const tenantId = req.userTenantId;

      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const transactions = await getCustomerRecentTransactions(customerId, 5);

      res.json({
        customerId,
        name: customer.name,
        currentBalance: Number(customer.paymentBalance),
        loyaltyPoints: customer.loyaltyPoints,
        creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
        lastPayment: customer.lastPaymentAt,
        recentTransactions: transactions,
      });
    } catch (error) {
      console.error("Error fetching statement:", error);
      res.status(500).json({ error: "Failed to fetch statement" });
    }
  },
);

export default invoiceRouter;
