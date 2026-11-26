/**
 * Penyimpanan draf di perangkat (IndexedDB), termasuk foto, agar laporan tidak
 * hilang saat halaman tertutup atau sinyal putus (readme bagian 6).
 * Tanpa dependensi tambahan.
 */

const DB_NAME = "whcontrol";
const DB_VERSION = 1;
const DRAFTS = "drafts";
const PHOTOS = "photos";

export interface StoredPhoto {
  id: string;
  full: Blob;
  thumb: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Browser ini tidak mendukung penyimpanan draf."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS);
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("Gagal membuka penyimpanan draf."));
    };
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error ?? new Error("Gagal menyimpan draf."));
        tx.onabort = () => reject(tx.error ?? new Error("Penyimpanan draf dibatalkan (memori penuh?)."));
      }),
  );
}

export const draftStore = {
  get<T>(key: string): Promise<T | undefined> {
    return run<T>(DRAFTS, "readonly", (s) => s.get(key) as IDBRequest<T>);
  },
  put<T>(key: string, value: T): Promise<void> {
    return run(DRAFTS, "readwrite", (s) => s.put(value, key)).then(() => undefined);
  },
  remove(key: string): Promise<void> {
    return run(DRAFTS, "readwrite", (s) => s.delete(key)).then(() => undefined);
  },
};

export const photoStore = {
  get(id: string): Promise<StoredPhoto | undefined> {
    return run<StoredPhoto>(PHOTOS, "readonly", (s) => s.get(id) as IDBRequest<StoredPhoto>);
  },
  put(photo: StoredPhoto): Promise<void> {
    return run(PHOTOS, "readwrite", (s) => s.put(photo)).then(() => undefined);
  },
  remove(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return Promise.resolve();
    return run(PHOTOS, "readwrite", (s) => {
      for (const id of ids) s.delete(id);
    }).then(() => undefined);
  },
};

/** Meminta browser agar draf tidak dihapus otomatis saat penyimpanan menipis. */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    // Tidak wajib.
  }
}
