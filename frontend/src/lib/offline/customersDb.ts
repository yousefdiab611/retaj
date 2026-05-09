import { withOfflineStore, getAllFromStore, getFromIndex } from "./db";

type OfflineCustomerRecord = {
  id: string;
  localId: string;
  remoteId?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  createdAt: number;
  updatedAt: number;
  dirty: boolean;
};

export type OfflineCustomerHit = {
  id: string;
  localId: string;
  remoteId?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  createdAt: number;
  updatedAt: number;
  dirty: boolean;
};

const STORE = "customers";

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

export async function saveOfflineCustomer(payload: {
  localId?: string;
  remoteId?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  dirty?: boolean;
}): Promise<OfflineCustomerHit> {
  const now = Date.now();
  const normalizedPhone = payload.phone?.trim() || null;
  const existing = await findOfflineCustomerByPhone(normalizedPhone);
  const localId = payload.localId ?? existing?.localId ?? crypto.randomUUID();
  const updated: OfflineCustomerRecord = {
    id: localId,
    localId,
    remoteId: payload.remoteId ?? existing?.remoteId,
    name: payload.name.trim(),
    phone: normalizedPhone,
    email: payload.email?.trim() || null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    dirty: payload.dirty ?? true,
  };

  await withOfflineStore(STORE, "readwrite", (store) => store.put(updated));
  return updated;
}

export async function listDirtyOfflineCustomers(): Promise<OfflineCustomerHit[]> {
  const rows = await getAllFromStore<OfflineCustomerRecord>(STORE);
  return rows.filter((row) => row.dirty).sort((a, b) => a.updatedAt - b.updatedAt);
}

export async function countDirtyOfflineCustomers(): Promise<number> {
  const all = await getAllFromStore<OfflineCustomerRecord>(STORE);
  return all.filter((row) => row.dirty).length;
}

export async function searchOfflineCustomers(query: string): Promise<OfflineCustomerHit[]> {
  const q = normalizeQuery(query);
  if (!q) return [];

  const rows = await getAllFromStore<OfflineCustomerRecord>(STORE);
  return rows
    .filter((row) => {
      const hay = [row.name, row.phone, row.email].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 50);
}

export async function findOfflineCustomerByPhone(
  phone?: string | null,
): Promise<OfflineCustomerHit | undefined> {
  if (!phone) return undefined;
  const result = await getFromIndex<OfflineCustomerRecord>(STORE, "phone", phone);
  if (result.length > 0) return result[0];
  return undefined;
}

export async function markOfflineCustomerSynced(localId: string, remoteId?: string): Promise<void> {
  const row = await withOfflineStore<OfflineCustomerRecord | undefined>(STORE, "readonly", (store) =>
    store.get(localId),
  );
  if (!row) return;
  const updated = { ...row, remoteId: remoteId ?? row.remoteId, dirty: false, updatedAt: Date.now() };
  await withOfflineStore(STORE, "readwrite", (store) => store.put(updated));
}

export async function getOfflineCustomerByLocalId(localId: string): Promise<OfflineCustomerHit | undefined> {
  return withOfflineStore<OfflineCustomerHit | undefined>(STORE, "readonly", (store) => store.get(localId));
}

export async function updateOfflineCustomer(payload: {
  localId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}): Promise<OfflineCustomerHit> {
  const existing = await getOfflineCustomerByLocalId(payload.localId);
  if (!existing) {
    return saveOfflineCustomer(payload);
  }

  const merged = {
    ...existing,
    name: payload.name.trim(),
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    dirty: true,
    updatedAt: Date.now(),
  };
  await withOfflineStore(STORE, "readwrite", (store) => store.put(merged));
  return merged;
}

export async function getAllOfflineCustomers(): Promise<OfflineCustomerHit[]> {
  return getAllFromStore<OfflineCustomerHit>(STORE);
}
