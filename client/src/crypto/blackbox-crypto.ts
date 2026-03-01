/**
 * Black Box encryption helpers.
 *
 * Thin wrappers around the core encrypt/decrypt functions.
 * Uses the same AES-256-GCM scheme but with a separate "access key"
 * (different from the main financial state passphrase).
 */

import type { EncryptedPayload } from '@fortress/types';
import type { BlackBoxContent } from '@fortress/types';
import { encrypt, decrypt, DecryptionError } from './crypto';

/**
 * Encrypt a BlackBoxContent object with the user's chosen access key.
 */
export async function encryptBlackBox(
  content: BlackBoxContent,
  accessKey: string,
): Promise<EncryptedPayload> {
  const json = JSON.stringify(content);
  return encrypt(json, accessKey);
}

/**
 * Decrypt an EncryptedPayload back into BlackBoxContent.
 * Validates the structure after decryption.
 */
export async function decryptBlackBox(
  payload: EncryptedPayload,
  accessKey: string,
): Promise<BlackBoxContent> {
  const json = await decrypt(payload, accessKey);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new DecryptionError('Decrypted Black Box data is not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new DecryptionError('Decrypted data is not a valid BlackBoxContent object');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.entries)) {
    throw new DecryptionError('Decrypted data is missing the entries array');
  }

  return parsed as BlackBoxContent;
}
