import { useEffect, useRef } from 'react';
import { useFinancialStore } from '../stores/financial-state';
import { useAuthStore } from '../stores/auth';
import { getPassphrase, encryptCurrentState, saveSnapshot } from '../crypto';

const DEBOUNCE_MS = 5_000;

/**
 * Auto-saves encrypted financial state to the server.
 * Active only when: authenticated + passphrase cached + data has content.
 * Debounces at 5 seconds after last change.
 */
export function useAutoSave(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    // Subscribe to financial store changes via Zustand's subscribe API
    const unsubscribe = useFinancialStore.subscribe(
      (current, prev) => {
        // Skip if state reference is the same (no actual change)
        if (current.state === prev.state) return;

        // Skip if no passphrase cached (user hasn't entered it yet)
        const passphrase = getPassphrase();
        if (!passphrase) return;

        // Skip if completeness is 0 (nothing entered yet)
        if (current.state.meta.completeness === 0) return;

        // Skip if not authenticated
        const authState = useAuthStore.getState();
        if (!authState.isAuthenticated || !authState.accessToken) return;

        // Clear any pending save
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        // Debounce save
        timerRef.current = setTimeout(async () => {
          // Re-check conditions at save time (they may have changed during debounce)
          const pp = getPassphrase();
          const auth = useAuthStore.getState();
          if (!pp || !auth.isAuthenticated || !auth.accessToken) return;
          if (savingRef.current) return; // Already saving

          savingRef.current = true;
          try {
            const payload = await encryptCurrentState(pp);
            await saveSnapshot(payload, auth.accessToken);
          } catch (err) {
            // On 401, try refreshing the session and retry once
            if (err instanceof Error && err.message.includes('401')) {
              const refreshed = await auth.refreshSession();
              if (refreshed) {
                const newAuth = useAuthStore.getState();
                const freshPp = getPassphrase();
                if (newAuth.accessToken && freshPp) {
                  try {
                    const payload = await encryptCurrentState(freshPp);
                    await saveSnapshot(payload, newAuth.accessToken);
                  } catch {
                    // Silently fail retry — user can manual save
                  }
                }
              }
            }
            // Silently fail — auto-save is best-effort
          } finally {
            savingRef.current = false;
          }
        }, DEBOUNCE_MS);
      },
    );

    return () => {
      unsubscribe();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
}
