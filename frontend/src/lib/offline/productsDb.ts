import { withOfflineStore, getAllFromStore, getFromIndex } from "./db";

import type { Product } from "@/types/product";

export type CachedProductRecord = Product & {
  warehouseId?: string;
  syncedAt: number;
  updatedAt: number;
};

const STORE = "products";

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

export async function saveCachedProducts(products: Product[], warehouseId?: string): Promise<void> {
  const now = Date.now();
  await withOfflineStore<void>(STORE, "readwrite", (store) => {
    for (const product of products) {
      store.put({
        ...product,
        warehouseId: warehouseId ?? "global",
        syncedAt: now,
        updatedAt: now,
      });
    }
    return store.getAll();
  });
}

export async function getCachedProducts(warehouseId?: string): Promise<Product[]> {
  const rows: CachedProductRecord[] = warehouseId
    ? await getFromIndex<CachedProductRecord>(STORE, "warehouseId", warehouseId)
    : await getAllFromStore<CachedProductRecord>(STORE);
  return rows.map(({ syncedAt, updatedAt, ...product }) => product);
}

export async function searchCachedProducts(query: string, warehouseId?: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  const rows: CachedProductRecord[] = warehouseId
    ? await getFromIndex<CachedProductRecord>(STORE, "warehouseId", warehouseId)
    : await getAllFromStore<CachedProductRecord>(STORE);

  const filtered = q
    ? rows.filter((row) => {
        const hay = [row.name, row.sku, row.barcode ?? "", row.category].join(" ").toLowerCase();
        return hay.includes(q);
      })
    : rows;

  return filtered.map(({ syncedAt, updatedAt, ...product }) => product);
}

export async function lookupCachedProductByCode(code: string, warehouseId?: string): Promise<Product> {
  const normalized = normalizeCode(code);
  const candidates: CachedProductRecord[] = warehouseId
    ? await getFromIndex<CachedProductRecord>(STORE, "warehouseId", warehouseId)
    : await getAllFromStore<CachedProductRecord>(STORE);

  const hit = candidates.find((row) => {
    const barcode = row.barcode?.trim().toLowerCase() ?? "";
    const sku = row.sku.trim().toLowerCase();
    return barcode === normalized || sku === normalized;
  });

  if (!hit) {
    throw new Error("Product not found in cache");
  }

  const { syncedAt, updatedAt, ...product } = hit;
  return product;
}

export async function getProductCacheTimestamp(warehouseId: string): Promise<number | null> {
  const result = await withOfflineStore<{ key: string; value: number } | undefined>(
    "sync_meta",
    "readonly",
    (store) => store.get(`productSync_${warehouseId}`),
  );
  return result?.value ?? null;
}

export async function setProductCacheTimestamp(warehouseId: string, timestamp: number): Promise<void> {
  await withOfflineStore("sync_meta", "readwrite", (store) =>
    store.put({ key: `productSync_${warehouseId}`, value: timestamp }),
  );
}
