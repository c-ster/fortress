import { useEffect, useRef } from 'react';
import { getBahFromCache, saveBahToCache } from '../utils/bah-cache';
import {
  setBahFullTable,
  fetchBahVersion,
  fetchBahTable,
  type BahTable,
} from '../utils/pay-tables';

/**
 * Background prefetch hook for the full BAH table.
 *
 * Strategy:
 *   1. Check IndexedDB for cached table → inject immediately if found
 *   2. Check server version hash → skip re-fetch if cache is up to date
 *   3. Fetch full table from server → inject + cache
 *
 * Graceful degradation: if anything fails, the bundled 20-ZIP stub still works.
 * Uses useRef to prevent double-execution in React StrictMode.
 */
export function useBahPrefetch(): void {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      // 1. Try IndexedDB cache first (instant, no network)
      const cached = await getBahFromCache();
      if (cached) {
        setBahFullTable(cached.data as BahTable);
      }

      // 2. Check server version to see if cache is stale
      let serverHash: string;
      try {
        const version = await fetchBahVersion();
        serverHash = version.hash;
      } catch {
        // Server unreachable — cached data (or stub) is all we have
        return;
      }

      // 3. If cache hash matches server hash, we're up to date
      if (cached && cached.hash === serverHash) {
        return;
      }

      // 4. Fetch full table from server
      const fullTable = await fetchBahTable();
      setBahFullTable(fullTable);

      // 5. Cache for next time
      await saveBahToCache(fullTable, serverHash);
    })().catch(() => {
      // Graceful degradation — stub data still works for major installations
    });
  }, []);
}
