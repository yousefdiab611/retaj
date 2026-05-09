import { withOfflineStore } from "./db";

const STORE = "sync_meta";

export async function setLastSyncAt(timestamp: number): Promise<void> {
  await withOfflineStore(STORE, "readwrite", (store) => store.put({ key: "lastSyncAt", value: timestamp }));
}

export async function getLastSyncAt(): Promise<number | null> {
  const result = await withOfflineStore<{ key: string; value: number } | undefined>(STORE, "readonly", (store) => store.get("lastSyncAt"));
  return result?.value ?? null;
}
