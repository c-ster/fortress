/**
 * Black Box API client.
 *
 * Manages encrypted Black Box CRUD + emergency contact access.
 * Same fetch pattern as the financial snapshot API.
 */

import type { EncryptedPayload, BlackBoxStatus } from '@fortress/types';
import { config } from '../config';

interface BlackBoxContact {
  contactName: string;
  contactEmail: string;
  expiresAt?: string;  // ISO date or omit for no expiry
}

/**
 * Save (create or update) the encrypted Black Box on the server.
 * Returns the plaintext access token (shown once to the owner).
 */
export async function saveBlackBox(
  payload: EncryptedPayload,
  contact: BlackBoxContact,
  accessToken: string,
): Promise<{ accessToken: string }> {
  const response = await fetch(`${config.apiUrl}/blackbox`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({
      ...payload,
      contactName: contact.contactName,
      contactEmail: contact.contactEmail,
      expiresAt: contact.expiresAt ?? undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to save Black Box: ${response.status} — ${body.message || response.statusText}`,
    );
  }

  return response.json() as Promise<{ accessToken: string }>;
}

/**
 * Load the owner's encrypted Black Box from the server.
 * Returns null if no Black Box exists (404).
 */
export async function loadBlackBox(
  accessToken: string,
): Promise<EncryptedPayload | null> {
  const response = await fetch(`${config.apiUrl}/blackbox`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to load Black Box: ${response.status} — ${body.message || response.statusText}`,
    );
  }

  return response.json() as Promise<EncryptedPayload>;
}

/**
 * Delete the owner's Black Box from the server.
 */
export async function deleteBlackBox(accessToken: string): Promise<void> {
  const response = await fetch(`${config.apiUrl}/blackbox`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  if (!response.ok && response.status !== 404) {
    const body = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to delete Black Box: ${response.status} — ${body.message || response.statusText}`,
    );
  }
}

/**
 * Emergency contact retrieves a Black Box by access token.
 * No authentication required — the token IS the authorization.
 */
export async function loadBlackBoxByToken(
  token: string,
): Promise<EncryptedPayload | null> {
  const response = await fetch(`${config.apiUrl}/blackbox/access/${token}`, {
    credentials: 'include',
  });

  if (response.status === 404 || response.status === 410) return null;

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to access Black Box: ${response.status} — ${body.message || response.statusText}`,
    );
  }

  return response.json() as Promise<EncryptedPayload>;
}

/**
 * Owner checks Black Box grant status.
 */
export async function getBlackBoxStatus(
  accessToken: string,
): Promise<BlackBoxStatus> {
  const response = await fetch(`${config.apiUrl}/blackbox/status`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to get Black Box status: ${response.status} — ${body.message || response.statusText}`,
    );
  }

  return response.json() as Promise<BlackBoxStatus>;
}
