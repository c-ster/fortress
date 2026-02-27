import type { EncryptedPayload } from '@fortress/types';
import { config } from '../config';

/**
 * Save an encrypted financial snapshot to the server.
 */
export async function saveSnapshot(
  payload: EncryptedPayload,
  accessToken: string,
): Promise<void> {
  const response = await fetch(`${config.apiUrl}/financial/snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to save snapshot: ${response.status} — ${body.message || response.statusText}`,
    );
  }
}

/**
 * Load the latest encrypted financial snapshot from the server.
 * Returns null if no snapshot exists (404).
 */
export async function loadSnapshot(
  accessToken: string,
): Promise<EncryptedPayload | null> {
  const response = await fetch(`${config.apiUrl}/financial/snapshot`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to load snapshot: ${response.status} — ${body.message || response.statusText}`,
    );
  }

  return response.json() as Promise<EncryptedPayload>;
}
