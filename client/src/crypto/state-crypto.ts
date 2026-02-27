import type { FinancialState, EncryptedPayload } from '@fortress/types';
import { encrypt, decrypt, DecryptionError } from './crypto';
import { useFinancialStore } from '../stores/financial-state';

const REQUIRED_KEYS: (keyof FinancialState)[] = [
  'income', 'deductions', 'expenses', 'debts',
  'assets', 'military', 'risk', 'meta',
];

/**
 * Encrypt a FinancialState into an EncryptedPayload.
 */
export async function encryptState(
  state: FinancialState,
  passphrase: string,
): Promise<EncryptedPayload> {
  const json = JSON.stringify(state);
  return encrypt(json, passphrase);
}

/**
 * Decrypt an EncryptedPayload back into a FinancialState and hydrate the Zustand store.
 * Returns the parsed state for caller convenience.
 */
export async function decryptAndHydrate(
  payload: EncryptedPayload,
  passphrase: string,
): Promise<FinancialState> {
  const json = await decrypt(payload, passphrase);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new DecryptionError('Decrypted data is not valid JSON');
  }

  // Structural validation — check top-level keys exist
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new DecryptionError('Decrypted data is not a valid FinancialState object');
  }

  const obj = parsed as Record<string, unknown>;
  const missing = REQUIRED_KEYS.filter((key) => !(key in obj));
  if (missing.length > 0) {
    throw new DecryptionError(
      `Decrypted data is missing required keys: ${missing.join(', ')}`,
    );
  }

  // Backward compat: old snapshots may lack actionStatuses
  if (!('actionStatuses' in obj)) {
    obj.actionStatuses = {};
  }

  const state = parsed as FinancialState;
  useFinancialStore.getState().hydrate(state);
  return state;
}

/**
 * Encrypt the current Zustand financial state.
 */
export async function encryptCurrentState(
  passphrase: string,
): Promise<EncryptedPayload> {
  const state = useFinancialStore.getState().state;
  return encryptState(state, passphrase);
}
