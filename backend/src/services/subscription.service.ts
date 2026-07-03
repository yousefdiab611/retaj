import { PaymentProvider, type Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";

import { createLicenseRecord } from "./license.service";
import { billingPlans } from "./payment.service";

import type { BillingPlanDefinition } from "./payment.service";

async function getOrCreateTenantBillingCustomer(tenantId: string) {
  const existing = await prisma.customer.findFirst({
    where: {
      tenantId,
      name: "Tenant Billing Account",
    },
  });

  if (existing) {
    return existing.id;
  }

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      name: "Tenant Billing Account",
      ownerName: "Billing",
      notes: "Auto-created billing customer for tenant subscription management.",
    },
    select: { id: true },
  });

  return customer.id;
}

export function getBillingPlans(): BillingPlanDefinition[] {
  return billingPlans;
}

export function getBillingPlanByKey(planKey: string): BillingPlanDefinition | null {
  return billingPlans.find((plan) => plan.key === planKey) ?? null;
}

export async function createSubscriptionDraft(params: {
  tenantId: string;
  planKey: string;
  interval: string;
  amountCents: number;
  currency: string;
  metadata: Prisma.InputJsonValue;
}) {
  return prisma.subscription.create({
    data: {
      tenantId: params.tenantId,
      customerId: await getOrCreateTenantBillingCustomer(params.tenantId),
      plan:
        params.planKey === "ENTERPRISE"
          ? "ENTERPRISE"
          : params.planKey === "PRO" || params.planKey === "PRO_YEARLY"
            ? "PRO"
            : "FREE",
      interval: params.interval === "YEARLY" ? "YEARLY" : params.interval === "MONTHLY" ? "MONTHLY" : "TRIAL",
      amountCents: params.amountCents,
      currency: params.currency,
      status: "ACTIVE",
      metadata: params.metadata,
    },
  });
}

export async function recordPaymentForSubscription(params: {
  tenantId: string;
  subscriptionId: string;
  provider: string;
  providerPaymentId: string;
  amountCents: number;
  currency: string;
  success: boolean;
  description?: string;
  receiptUrl?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.payment.create({
    data: {
      tenantId: params.tenantId,
      subscriptionId: params.subscriptionId,
      provider:
        params.provider in PaymentProvider ? (params.provider as PaymentProvider) : PaymentProvider.OFFLINE,
      providerPaymentId: params.providerPaymentId,
      status: params.success ? "SUCCEEDED" : "FAILED",
      amountCents: params.amountCents,
      currency: params.currency,
      description: params.description,
      receiptUrl: params.receiptUrl,
      metadata: params.metadata,
    },
  });
}

export async function activateSubscriptionForTenant(tenantId: string, subscriptionId: string) {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "ACTIVE", cancelAtPeriodEnd: false },
  });
}

export async function createLicenseForSubscription(params: {
  subscriptionId: string;
  tenantId: string;
  expiresAt?: Date | null;
  trialMode?: boolean;
}) {
  const license = await createLicenseRecord({
    tenantId: params.tenantId,
    expiresAt: params.expiresAt,
    trialMode: params.trialMode,
  });

  await prisma.subscription.update({
    where: { id: params.subscriptionId },
    data: { licenseId: license.id },
  });

  return license;
}

export async function cancelSubscription(tenantId: string, subscriptionId: string) {
  return prisma.subscription.updateMany({
    where: { id: subscriptionId, tenantId },
    data: { status: "CANCELLED", cancelAtPeriodEnd: true },
  });
}

export async function getTenantSubscriptions(tenantId: string) {
  return prisma.subscription.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}
