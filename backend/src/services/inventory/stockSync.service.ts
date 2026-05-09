import { prisma } from "../../lib/prisma";

import type { Prisma } from "@prisma/client";

export async function syncProductTotalStock(
  productId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const agg = await db.productStock.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  const total = agg._sum.quantity ?? 0;
  await db.product.update({
    where: { id: productId },
    data: { stockQty: total },
  });
  return total;
}
