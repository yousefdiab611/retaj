import { Decimal } from "@prisma/client/runtime/library";

import { roundMoney2 } from "../lib/money";
import { prisma } from "../lib/prisma";

// Get latest 5 transactions for statement
export async function getCustomerRecentTransactions(customerId: string, limit = 5) {
  return prisma.customerCreditLedger.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      note: true,
      createdAt: true,
    },
  });
}

// Calculate all invoice payment and balance fields
export interface InvoicePaymentSnapshot {
  invoiceTotal: number;
  paidAmount: number;
  remainingAmount: number;
  previousBalance: number;
  totalOutstanding: number;
}

export async function calculateInvoicePayments(
  customerId: string,
  invoiceTotal: number,
  paidAmount: number,
  isCashCustomer: boolean = false,
): Promise<InvoicePaymentSnapshot> {
  // Get customer's previous balance before this transaction
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      paymentBalance: true,
      isCashCustomer: true,
    },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  const isActuallyCash = isCashCustomer || customer.isCashCustomer;
  const previousBalance = isActuallyCash ? 0 : Number(customer.paymentBalance);

  // Calculate remaining amount
  let remainingAmount = Math.max(0, invoiceTotal - paidAmount);

  // If customer is cash customer, no balance tracking
  if (isActuallyCash) {
    remainingAmount = 0;
  }

  // Total outstanding = previous balance + new remaining
  const totalOutstanding = previousBalance + remainingAmount;

  return {
    invoiceTotal: roundMoney2(invoiceTotal),
    paidAmount: roundMoney2(paidAmount),
    remainingAmount: roundMoney2(remainingAmount),
    previousBalance: roundMoney2(previousBalance),
    totalOutstanding: roundMoney2(totalOutstanding),
  };
}

// Calculate loyalty points earned from transaction
export function calculateLoyaltyPointsEarned(transactionTotal: number, loyaltyPointRate: number = 1): number {
  // 1 point per X SAR (default 1 point per 1 SAR)
  const pointsEarned = Math.floor(transactionTotal / loyaltyPointRate);
  return Math.max(0, pointsEarned);
}

// Get customer account info snapshot
export async function getCustomerAccountSnapshot(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      name: true,
      phone: true,
      paymentBalance: true,
      loyaltyPoints: true,
      creditLimit: true,
      lastPaymentAt: true,
      totalInvoices: true,
    },
  });

  if (!customer) {
    return null;
  }

  const recentTransactions = await getCustomerRecentTransactions(customerId, 5);

  return {
    customerName: customer.name,
    customerPhone: customer.phone || "",
    lastPaymentDate: customer.lastPaymentAt,
    previousInvoiceCount: customer.totalInvoices,
    customerCreditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
    previousBalance: Number(customer.paymentBalance),
    loyaltyPointsBefore: customer.loyaltyPoints,
    recentTransactions,
  };
}

// Create or update invoice with all calculated fields
export async function createOrUpdateInvoice(
  tenantId: string,
  customerId: string,
  data: {
    invoiceNumber?: number;
    invoiceTotal: number;
    paidAmount: number;
    subtotal: number;
    tax: number;
    discount: number;
    paymentMethod?: string;
    status?: string;
    dueDate: Date;
    loyaltyPointRate?: number;
    notes?: string;
  },
  invoiceId?: string,
) {
  // Get loyalty point rate from tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { loyaltyPointRate: true },
  });

  const loyaltyPointRate = tenant?.loyaltyPointRate || 1;

  // Calculate all payment fields
  const payments = await calculateInvoicePayments(customerId, data.invoiceTotal, data.paidAmount);

  // Calculate loyalty points
  const loyaltyPointsEarned = calculateLoyaltyPointsEarned(data.invoiceTotal, loyaltyPointRate);

  // Get customer account snapshot
  const accountSnapshot = await getCustomerAccountSnapshot(customerId);
  if (!accountSnapshot) {
    throw new Error("Customer not found for snapshot");
  }

  // Get next loyalty point threshold (if integrated with rewards system)
  const nextRewardThreshold =
    loyaltyPointsEarned > 0
      ? Math.ceil((accountSnapshot.loyaltyPointsBefore + loyaltyPointsEarned) / 100) * 100
      : null;

  // Determine status
  let status = data.status || "PENDING";
  if (payments.remainingAmount === 0) {
    status = "PAID";
  } else if (payments.paidAmount > 0) {
    status = "PARTIALLY_PAID";
  }

  const invoiceData = {
    tenantId,
    customerId,
    invoiceNumber: data.invoiceNumber,
    invoiceTotal: new Decimal(payments.invoiceTotal),
    paidAmount: new Decimal(payments.paidAmount),
    remainingAmount: new Decimal(payments.remainingAmount),
    previousBalance: new Decimal(payments.previousBalance),
    totalOutstanding: new Decimal(payments.totalOutstanding),
    subtotal: new Decimal(data.subtotal),
    tax: new Decimal(data.tax),
    discount: new Decimal(data.discount),
    customerName: accountSnapshot.customerName,
    customerPhone: accountSnapshot.customerPhone,
    lastPaymentDate: accountSnapshot.lastPaymentDate,
    previousInvoiceCount: accountSnapshot.previousInvoiceCount,
    customerCreditLimit: accountSnapshot.customerCreditLimit
      ? new Decimal(accountSnapshot.customerCreditLimit)
      : null,
    loyaltyPointsEarned,
    loyaltyPointsBefore: accountSnapshot.loyaltyPointsBefore,
    loyaltyPointsAfter: accountSnapshot.loyaltyPointsBefore + loyaltyPointsEarned,
    nextRewardThreshold,
    paymentMethod: data.paymentMethod,
    currency: "SAR",
    status,
    dueDate: data.dueDate,
    paidAt: payments.paidAmount > 0 ? new Date() : null,
    paidFullyAt: payments.remainingAmount === 0 ? new Date() : null,
    isFullyPaid: payments.remainingAmount === 0,
    notes: data.notes,
  };

  if (invoiceId) {
    // Update existing
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: invoiceData,
    });
  } else {
    // Create new with generated number
    const lastInvoice = await prisma.invoice.findFirst({
      where: { tenantId },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });

    const nextInvoiceNumber = (lastInvoice?.invoiceNumber || 0) + 1;
    invoiceData.invoiceNumber = nextInvoiceNumber;

    return prisma.invoice.create({
      data: {
        ...invoiceData,
        number: `INV-${tenantId.substring(0, 3).toUpperCase()}-${String(nextInvoiceNumber).padStart(5, "0")}`,
      },
    });
  }
}

// Create loyalty points record
export async function recordLoyaltyPoints(
  tenantId: string,
  customerId: string,
  points: number,
  invoiceId: string | null,
  type: string = "EARNED",
  reason?: string,
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { loyaltyPoints: true },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  const balanceBefore = customer.loyaltyPoints;
  const balanceAfter = Math.max(0, balanceBefore + (type === "REDEEMED" ? -points : points));

  const loyaltyRecord = await prisma.loyaltyPoint.create({
    data: {
      tenantId,
      customerId,
      invoiceId,
      points,
      type,
      balanceBefore,
      balanceAfter,
      reason,
    },
  });

  // Update customer's total loyalty points
  await prisma.customer.update({
    where: { id: customerId },
    data: { loyaltyPoints: balanceAfter },
  });

  return loyaltyRecord;
}

// Update customer balance after payment
export async function updateCustomerBalance(
  customerId: string,
  newBalance: number,
  invoiceId?: string,
  notes?: string,
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { paymentBalance: true },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  const previousBalance = Number(customer.paymentBalance);

  // Update customer
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      paymentBalance: new Decimal(newBalance),
      lastPaymentAt: new Date(),
    },
  });

  // Record in credit ledger
  await prisma.customerCreditLedger.create({
    data: {
      customerId,
      invoiceId: invoiceId || null,
      type: newBalance < previousBalance ? "PAYMENT" : "ADJUSTMENT",
      amount: new Decimal(Math.abs(previousBalance - newBalance)),
      balanceAfter: new Decimal(newBalance),
      note: notes,
    },
  });
}

// Get invoice with all details for display
export async function getInvoiceWithDetails(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          creditLimit: true,
        },
      },
      tenant: {
        select: {
          name: true,
          storeAddress: true,
          storePhone: true,
          invoiceLogoUrl: true,
          invoiceThankYou: true,
          invoiceFooterNote: true,
          loyaltyPointRate: true,
        },
      },
    },
  });

  if (!invoice) {
    return null;
  }

  return {
    ...invoice,
    invoiceTotal: Number(invoice.invoiceTotal),
    paidAmount: Number(invoice.paidAmount),
    remainingAmount: Number(invoice.remainingAmount),
    previousBalance: Number(invoice.previousBalance),
    totalOutstanding: Number(invoice.totalOutstanding),
    subtotal: Number(invoice.subtotal),
    tax: Number(invoice.tax),
    discount: Number(invoice.discount),
    customerCreditLimit: invoice.customerCreditLimit ? Number(invoice.customerCreditLimit) : null,
  };
}

// Generate next invoice number
export async function generateInvoiceNumber(tenantId: string): Promise<number> {
  const lastInvoice = await prisma.invoice.findFirst({
    where: { tenantId },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  return (lastInvoice?.invoiceNumber || 0) + 1;
}
