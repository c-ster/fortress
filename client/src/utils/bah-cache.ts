/**
 * IndexedDB cache for the full BAH table.
 * Stores the table data + version hash so we only re-download when data changes.
 *
 * Uses the raw IndexedDB API — no external dependencies.
 */

const DB_NAME = 'fortress-bah';
const DB_VERSION = 1;
const STORE_NAME = 'tables';

interface CachedBahEntry {
  key: string;
  data: unknown;
  hash: string;
  cachedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve the cached BAH table + hash from IndexedDB.
 * Returns null if nothing is cached.
 */
export async function getBahFromCache(): Promise<{ data: unknown; hash: string } | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get('bah-2025');

      request.onsuccess = () => {
        const entry = request.result as CachedBahEntry | undefined;
        if (entry) {
          resolve({ data: entry.data, hash: entry.hash });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

/**
 * Save the BAH table + hash to IndexedDB.
 */
export async function saveBahToCache(data: unknown, hash: string): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const entry: CachedBahEntry = {
        key: 'bah-2025',
        data,
        hash,
        cachedAt: Date.now(),
      };

      store.put(entry);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Silently fail — the stub fallback still works
  }
}
