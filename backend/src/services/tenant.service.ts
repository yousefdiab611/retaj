import { SubscriptionPlan } from "@prisma/client";

import { prisma } from "../lib/prisma";

import type { BillingStatus } from "@prisma/client";

export type TenantRow = {
  id: string;
  name: string;
  domain: string | null;
  plan: SubscriptionPlan;
  billingStatus: BillingStatus;
  planExpiresAt: Date | null;
  maxUsers: number;
  maxBranches: number;
  maxProducts: number;
  isActive: boolean;
  branchCount: number;
  createdAt: Date;
  updatedAt: Date;
};

function selectTenantFields() {
  return {
    id: true,
    name: true,
    domain: true,
    plan: true,
    billingStatus: true,
    planExpiresAt: true,
    maxUsers: true,
    maxBranches: true,
    maxProducts: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

export async function listTenants(): Promise<TenantRow[]> {
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: {
      ...selectTenantFields(),
      _count: { select: { branches: true } },
    },
  });
  return tenants.map((tenant) => ({
    ...tenant,
    branchCount: tenant._count.branches,
  }));
}

export async function getTenantById(id: string): Promise<TenantRow | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      ...selectTenantFields(),
      _count: { select: { branches: true } },
    },
  });
  if (!tenant) return null;
  return {
    ...tenant,
    branchCount: tenant._count.branches,
  };
}

export async function createTenant(data: {
  name: string;
  domain?: string | null;
  plan?: SubscriptionPlan;
}): Promise<TenantRow> {
  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      domain: data.domain ?? null,
      plan: data.plan ?? SubscriptionPlan.FREE,
    },
    select: {
      ...selectTenantFields(),
      _count: { select: { branches: true } },
    },
  });
  return {
    ...tenant,
    branchCount: tenant._count.branches,
  };
}

export async function updateTenant(
  id: string,
  data: {
    name?: string;
    domain?: string | null;
    plan?: SubscriptionPlan;
    billingStatus?: BillingStatus;
    planExpiresAt?: Date | null;
    isActive?: boolean;
  },
): Promise<TenantRow> {
  const tenant = await prisma.tenant.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.domain !== undefined ? { domain: data.domain } : {}),
      ...(data.plan !== undefined ? { plan: data.plan } : {}),
      ...(data.billingStatus !== undefined ? { billingStatus: data.billingStatus } : {}),
      ...(data.planExpiresAt !== undefined ? { planExpiresAt: data.planExpiresAt } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    select: {
      ...selectTenantFields(),
      _count: { select: { branches: true } },
    },
  });
  return {
    ...tenant,
    branchCount: tenant._count.branches,
  };
}
