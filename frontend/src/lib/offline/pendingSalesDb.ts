import { withOfflineStore, getAllFromStore } from "./db";

import type { PaymentMethod } from "@/lib/api";

const STORE = "pending_sales";

export type QueuedSaleBody = {
  customerId?: string | null;
  customerLocalId?: string | null;
  warehouseId?: string;
  discount: number;
  paymentMethod: PaymentMethod;
  lineItems: { productId: string; quantity: number }[];
};

export type PendingSaleRecord = {
  idempotencyKey: string;
  createdAt: number;
  sale: QueuedSaleBody;
  lastError?: string;
  nextRetryAt?: number;
};

export async function enqueuePendingSale(record: PendingSaleRecord): Promise<void> {
  await withOfflineStore("pending_sales", "readwrite", (store) => store.put(record));
}

export async function removePendingSale(idempotencyKey: string): Promise<void> {
  await withOfflineStore("pending_sales", "readwrite", (store) => store.delete(idempotencyKey));
}

export async function listPendingSales(): Promise<PendingSaleRecord[]> {
  const rows = await getAllFromStore<PendingSaleRecord>(STORE);
  rows.sort((a, b) => a.createdAt - b.createdAt);
  return rows;
}

export async function updatePendingSaleRetry(
  idempotencyKey: string,
  patch: { lastError?: string; nextRetryAt?: number },
): Promise<void> {
  const row = await withOfflineStore<PendingSaleRecord | undefined>(STORE, "readonly", (store) =>
    store.get(idempotencyKey),
  );
  if (!row) return;
  await withOfflineStore("pending_sales", "readwrite", (store) => store.put({ ...row, ...patch }));
}

export async function countPendingSales(): Promise<number> {
  const rows = await getAllFromStore<PendingSaleRecord>(STORE);
  return rows.length;
}
