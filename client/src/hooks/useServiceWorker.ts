import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to register and manage the PWA service worker.
 *
 * Uses the virtual module `virtual:pwa-register` provided by vite-plugin-pwa.
 * Returns offline/update state for UI indicators.
 */
export function useServiceWorker() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFn, setUpdateFn] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    // Dynamic import so the virtual module doesn't break tests/SSR
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const update = registerSW({
          onRegisteredSW(_url: string) {
            // SW registered successfully
          },
          onOfflineReady() {
            setOfflineReady(true);
          },
          onNeedRefresh() {
            setNeedRefresh(true);
          },
        });
        setUpdateFn(() => update);
      })
      .catch(() => {
        // SW registration unavailable (dev mode, tests, or unsupported browser)
      });
  }, []);

  const updateServiceWorker = useCallback(async () => {
    if (updateFn) await updateFn();
  }, [updateFn]);

  const dismissOfflineReady = useCallback(() => {
    setOfflineReady(false);
  }, []);

  return { offlineReady, needRefresh, updateServiceWorker, dismissOfflineReady };
}
