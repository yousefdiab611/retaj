import { AuditActions } from "../constants/auditActions";
import { writeAuditLog } from "./audit.service";
import { createSaleTransaction } from "./transactionSale.service";
import type { z } from "zod";

import { offlineSyncItemSchema } from "../validation/schemas";

type OfflineItem = z.infer<typeof offlineSyncItemSchema>;

export type OfflineSyncRowResult =
  | {
      idempotencyKey: string;
      ok: true;
      transaction: {
        id: string;
        reference: string;
        subtotal: number;
        discount: number;
        tax: number;
        total: number;
        paymentMethod: string | null;
        createdAt: string;
      };
      idempotentReplay?: boolean;
    }
  | {
      idempotencyKey: string;
      ok: false;
      code: string;
      message: string;
    };

export async function processOfflineSyncBatch(
  branchId: string,
  userId: string,
  _userRole: unknown,
  items: OfflineItem[],
  meta: { ip?: string; userAgent?: string },
): Promise<{ results: OfflineSyncRowResult[] }> {
  const results: OfflineSyncRowResult[] = [];
  let created = 0;
  let replays = 0;

  for (const item of items) {
    const idempotencyKey = item.idempotencyKey;
    const result = await createSaleTransaction(branchId, userId, item, meta);
    if (!result.ok) {
      const message =
        result.code === "CUSTOMER_NOT_FOUND"
          ? "Customer not found"
          : result.code === "INVALID_PRODUCT"
            ? "Invalid or inactive product"
            : result.code === "INSUFFICIENT_STOCK"
              ? "Insufficient stock"
              : result.code === "INVALID_WAREHOUSE"
                ? "Invalid warehouse"
                : result.code === "NO_WAREHOUSE"
                  ? "No warehouse configured"
                  : result.code === "STOCK_RACE"
                    ? "Stock changed; retry"
                    : result.code === "IDEMPOTENCY_CONFLICT"
                      ? "Idempotency key belongs to another user or branch"
                      : "Sale failed";
      results.push({
        idempotencyKey,
        ok: false,
        code: result.code,
        message,
      });
      continue;
    }
    if (result.idempotentReplay) {
      replays += 1;
    } else {
      created += 1;
    }
    results.push({
      idempotencyKey,
      ok: true,
      transaction: result.transaction,
      idempotentReplay: result.idempotentReplay,
    });
  }

  await writeAuditLog({
    action: AuditActions.OFFLINE_SYNC_BATCH,
    userId,
    entityType: "OfflineSync",
    entityId: branchId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: {
      branchId,
      itemCount: items.length,
      created,
      idempotentReplays: replays,
      failed: results.filter((r) => !r.ok).length,
    },
  });

  return { results };
}
