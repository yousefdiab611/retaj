const DB_NAME = "retaj_pos_offline_v1";
const DB_VERSION = 2;

export type IdKey = string | readonly string[];

function createStores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains("pending_sales")) {
    db.createObjectStore("pending_sales", { keyPath: "idempotencyKey" });
  }

  if (!db.objectStoreNames.contains("customers")) {
    const store = db.createObjectStore("customers", { keyPath: "localId" });
    store.createIndex("phone", "phone", { unique: false });
    store.createIndex("remoteId", "remoteId", { unique: false });
    store.createIndex("dirty", "dirty", { unique: false });
  }

  if (!db.objectStoreNames.contains("products")) {
    const store = db.createObjectStore("products", { keyPath: ["id", "warehouseId"] });
    store.createIndex("warehouseId", "warehouseId", { unique: false });
    store.createIndex("barcode", "barcode", { unique: false });
    store.createIndex("sku", "sku", { unique: false });
    store.createIndex("updatedAt", "updatedAt", { unique: false });
  }

  if (!db.objectStoreNames.contains("cart")) {
    db.createObjectStore("cart", { keyPath: "key" });
  }

  if (!db.objectStoreNames.contains("sync_meta")) {
    db.createObjectStore("sync_meta", { keyPath: "key" });
  }
}

export function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      createStores(req.result);
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export async function withOfflineStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => {
      resolve((request.result as T[]) ?? []);
      db.close();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB getAll failed"));
      db.close();
    };
  });
}

export async function getFromIndex<T>(storeName: string, indexName: string, key: IDBValidKey): Promise<T[]> {
  return withOfflineStore(storeName, "readonly", (store) => store.index(indexName).getAll(key));
}
