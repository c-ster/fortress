import { lt, eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { refreshTokens, devices } from '../db/schema.js';
import { config } from '../config.js';

/**
 * Delete all expired refresh tokens from the database.
 * Called on server startup and can be extended with periodic cleanup.
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db
    .delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, new Date()));
  return result.rowCount ?? 0;
}

/**
 * Delete devices that haven't been seen in 90 days.
 */
export async function cleanupStaleDevices(): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(devices)
    .where(lt(devices.lastUsedAt, cutoff));
  return result.rowCount ?? 0;
}

/**
 * Revoke all refresh tokens for a given user (force logout everywhere).
 */
export async function revokeUserSessions(userId: string): Promise<number> {
  const result = await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.userId, userId));
  return result.rowCount ?? 0;
}

/**
 * Check whether a token's lastUsedAt exceeds the idle timeout.
 * Returns true if the session is still active (not idle).
 */
export function isSessionActive(lastUsedAt: Date): boolean {
  const elapsed = (Date.now() - lastUsedAt.getTime()) / 1000;
  return elapsed <= config.sessionIdleTimeout;
}
