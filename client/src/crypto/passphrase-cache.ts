/**
 * In-memory passphrase cache for auto-save.
 * Module-level variable — cleared on page refresh (security by design).
 * Explicitly cleared on logout via auth store.
 */
let cached: string | null = null;

export const setPassphrase = (p: string): void => {
  cached = p;
};

export const getPassphrase = (): string | null => cached;

export const clearPassphrase = (): void => {
  cached = null;
};
