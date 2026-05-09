import { getToken, syncOfflineTransactionsRequest } from "@/lib/api";

import { getOfflineCustomerByLocalId } from "./customersDb";
import { listPendingSales, removePendingSale, updatePendingSaleRetry } from "./pendingSalesDb";

let backoffMs = 2000;
let flushInFlight: Promise<void> | null = null;

/** Exponential backoff after full request failure; resets on successful HTTP sync call. */
export function resetOfflineSyncBackoff(): void {
  backoffMs = 2000;
}

export async function flushOfflineSalesQueue(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (!getToken()) return;

    const rows = await listPendingSales();
    if (rows.length === 0) return;

    const now = Date.now();
    const ready = rows.filter((r) => (r.nextRetryAt ?? 0) <= now);
    if (ready.length === 0) return;

    const items = await Promise.all(
      ready.map(async (r) => {
        const customerId = r.sale.customerId;
        const customerLocalId = r.sale.customerLocalId;
        let resolvedCustomerId = customerId;

        if (!resolvedCustomerId && customerLocalId) {
          const customer = await getOfflineCustomerByLocalId(customerLocalId);
          if (customer?.remoteId) {
            resolvedCustomerId = customer.remoteId;
          }
        }

        return {
          ...r.sale,
          customerId: resolvedCustomerId ?? null,
          customerLocalId: r.sale.customerLocalId,
          idempotencyKey: r.idempotencyKey,
        };
      }),
    );

    try {
      const { results } = await syncOfflineTransactionsRequest({ items });
      resetOfflineSyncBackoff();
      for (const r of results) {
        if (r.ok) {
          await removePendingSale(r.idempotencyKey);
        } else {
          await updatePendingSaleRetry(r.idempotencyKey, {
            lastError: r.message,
            nextRetryAt: Date.now() + backoffMs,
          });
        }
      }
    } catch {
      const next = Date.now() + backoffMs;
      backoffMs = Math.min(backoffMs * 2, 120_000);
      for (const r of ready) {
        await updatePendingSaleRetry(r.idempotencyKey, {
          lastError: "Sync failed — will retry",
          nextRetryAt: next,
        });
      }
    }
  })();
  try {
    await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}
