import { listDirtyOfflineCustomers, markOfflineCustomerSynced } from "./customersDb";
import { setLastSyncAt } from "./syncMeta";

import { createCustomerRequest, getToken, updateCustomerRequest } from "@/lib/api";

let customerSyncLock: Promise<void> | null = null;

export async function flushOfflineCustomerQueue(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (!getToken()) return;

  if (customerSyncLock) return customerSyncLock;
  customerSyncLock = (async () => {
    const dirty = await listDirtyOfflineCustomers();
    if (dirty.length === 0) return;

    for (const record of dirty) {
      try {
        const payload = {
          name: record.name,
          email: record.email ?? undefined,
          phone: record.phone ?? undefined,
        };
        const remote = record.remoteId
          ? await updateCustomerRequest(record.remoteId, payload)
          : await createCustomerRequest(payload);
        await markOfflineCustomerSynced(record.localId, remote.id);
      } catch {
        // keep dirty record and retry later
      }
    }

    await setLastSyncAt(Date.now());
  })();

  try {
    await customerSyncLock;
  } finally {
    customerSyncLock = null;
  }
}
