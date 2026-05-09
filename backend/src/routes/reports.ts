import { Router } from "express";

import { prisma } from "../lib/prisma";
import { roundMoney2 } from "../lib/money";

export const reportsRouter = Router();

function parseDateRange(req: { query: Record<string, unknown> }): { from: Date; to: Date } | null {
  const fromRaw = typeof req.query.from === "string" ? req.query.from : "";
  const toRaw = typeof req.query.to === "string" ? req.query.to : "";
  if (!fromRaw || !toRaw) return null;
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  if (from > to) return null;
  return { from, to };
}

reportsRouter.get("/summary", async (req, res) => {
  const range = parseDateRange(req);
  if (!range) {
    res.status(400).json({ error: "from and to are required (ISO date strings)" });
    return;
  }
  const { from, to } = range;
  const cashierOnly = req.userRole === "CASHIER";
  const userId = req.userId;
  if (cashierOnly && !userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (cashierOnly && !req.userBranchId) {
    res.status(403).json({ error: "No branch assigned", code: "NO_BRANCH" });
    return;
  }

  const branchScope =
    cashierOnly && req.userBranchId
      ? { branchId: req.userBranchId }
      : req.activeBranchId
        ? { branchId: req.activeBranchId }
        : {};

  const where = {
    status: "COMPLETED" as const,
    tenantId: req.userTenantId,
    createdAt: { gte: from, lte: to },
    ...branchScope,
    ...(cashierOnly ? { userId } : {}),
  };

  const [agg, transactions] = await Promise.all([
    prisma.transaction.aggregate({
      where,
      _count: { _all: true },
      _sum: { total: true, tax: true, discount: true, subtotal: true },
    }),
    prisma.transaction.findMany({
      where,
      select: { id: true, createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const transactionIds = transactions.map((t) => t.id);
  const lineItems = transactionIds.length
    ? await prisma.transactionLine.findMany({
        where: { transactionId: { in: transactionIds } },
        select: {
          quantity: true,
          lineTotal: true,
          transactionId: true,
          product: { select: { cost: true } },
        },
      })
    : [];

  const profitByTransaction = lineItems.reduce((sum, line) => {
    const cost = Number(line.product.cost ?? 0) * line.quantity;
    return sum + (Number(line.lineTotal) - cost);
  }, 0);

  const byDayMap = new Map<string, { revenue: number; count: number }>();
  for (const t of transactions) {
    const key = t.createdAt.toISOString().slice(0, 10);
    const prev = byDayMap.get(key) ?? { revenue: 0, count: 0 };
    prev.revenue += Number(t.total);
    prev.count += 1;
    byDayMap.set(key, prev);
  }
  const byDay = [...byDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, revenue: v.revenue, count: v.count }));

  res.json({
    summary: {
      transactionCount: agg._count._all,
      revenue: Number(agg._sum.total ?? 0),
      tax: Number(agg._sum.tax ?? 0),
      discount: Number(agg._sum.discount ?? 0),
      subtotal: Number(agg._sum.subtotal ?? 0),
      profit: roundMoney2(profitByTransaction),
    },
    byDay,
  });
});

reportsRouter.get("/transactions", async (req, res) => {
  const range = parseDateRange(req);
  if (!range) {
    res.status(400).json({ error: "from and to are required (ISO date strings)" });
    return;
  }
  const { from, to } = range;
  const cashierOnly = req.userRole === "CASHIER";
  const userId = req.userId;
  if (cashierOnly && !userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (cashierOnly && !req.userBranchId) {
    res.status(403).json({ error: "No branch assigned", code: "NO_BRANCH" });
    return;
  }

  const branchScope =
    cashierOnly && req.userBranchId
      ? { branchId: req.userBranchId }
      : req.activeBranchId
        ? { branchId: req.activeBranchId }
        : {};

  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const transactions = await prisma.transaction.findMany({
    where: {
      status: "COMPLETED",
      tenantId: req.userTenantId,
      createdAt: { gte: from, lte: to },
      ...branchScope,
      ...(cashierOnly ? { userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      reference: true,
      total: true,
      subtotal: true,
      tax: true,
      discount: true,
      paymentMethod: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      customer: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      lineItems: {
        select: {
          quantity: true,
          lineTotal: true,
          product: { select: { cost: true } },
        },
      },
    },
  });

  res.json({
    transactions: transactions.map((t) => {
      const profit = t.lineItems.reduce((sum, line) => {
        const cost = Number(line.product.cost ?? 0) * line.quantity;
        return sum + (Number(line.lineTotal) - cost);
      }, 0);
      return {
        id: t.id,
        reference: t.reference,
        total: Number(t.total),
        subtotal: Number(t.subtotal),
        tax: Number(t.tax),
        discount: Number(t.discount),
        paymentMethod: t.paymentMethod,
        createdAt: t.createdAt.toISOString(),
        user: t.user,
        customer: t.customer,
        branch: t.branch,
        profit: roundMoney2(profit),
      };
    }),
  });
});
