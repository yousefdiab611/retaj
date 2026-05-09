import type { BillingStatus, SubscriptionPlan } from "@prisma/client";
import { prisma } from "./prisma";

export const planLimits: Record<SubscriptionPlan, { users: number; branches: number; products: number }> = {
  FREE: { users: 3, branches: 1, products: 100 },
  TRIAL: { users: 3, branches: 1, products: 100 },
  PRO: { users: 10, branches: 5, products: 2000 },
  ENTERPRISE: { users: 100, branches: 20, products: 10000 },
};

export function isBillingActive(status: BillingStatus | undefined, expiresAt: Date | null | undefined): boolean {
  if (!status || status !== "ACTIVE") return false;
  if (expiresAt && expiresAt.getTime() < Date.now()) return false;
  return true;
}

export function getTenantLimit(plan: SubscriptionPlan) {
  return planLimits[plan] ?? planLimits.FREE;
}

export async function tenantUsageStatus(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return null;
  const isActive = isBillingActive(tenant.billingStatus, tenant.planExpiresAt);
  const limits = getTenantLimit(tenant.plan);
  const [userCount, branchCount, productCount] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.branch.count({ where: { tenantId } }),
    prisma.product.count({ where: { branch: { tenantId } } }),
  ]);
  const overLimit = {
    users: userCount > limits.users,
    branches: branchCount > limits.branches,
    products: productCount > limits.products,
  };
  const restricted = !isActive || overLimit.users || overLimit.branches || overLimit.products;
  return {
    tenant,
    limits,
    counts: { users: userCount, branches: branchCount, products: productCount },
    restricted,
    overLimit,
    active: isActive,
  };
}

export async function ensureTenantCanCreateBranch(tenantId: string) {
  const status = await tenantUsageStatus(tenantId);
  if (!status) {
    throw new Error("TENANT_NOT_FOUND");
  }
  if (!status.active) {
    throw new Error("TENANT_RESTRICTED");
  }
  if (status.counts.branches >= status.limits.branches) {
    throw new Error("PLAN_BRANCH_LIMIT");
  }
}

export async function ensureTenantCanCreateProduct(tenantId: string) {
  const status = await tenantUsageStatus(tenantId);
  if (!status) {
    throw new Error("TENANT_NOT_FOUND");
  }
  if (!status.active) {
    throw new Error("TENANT_RESTRICTED");
  }
  if (status.counts.products >= status.limits.products) {
    throw new Error("PLAN_PRODUCT_LIMIT");
  }
}

export async function ensureTenantCanCreateUser(tenantId: string) {
  const status = await tenantUsageStatus(tenantId);
  if (!status) {
    throw new Error("TENANT_NOT_FOUND");
  }
  if (!status.active) {
    throw new Error("TENANT_RESTRICTED");
  }
  if (status.counts.users >= status.limits.users) {
    throw new Error("PLAN_USER_LIMIT");
  }
}
