/**
 * Server-side device fingerprint management.
 *
 * Tracks known devices per user for zero-trust security.
 * The fingerprint is a SHA-256 hex string generated client-side from
 * browser properties — it is a detection layer, not an auth layer.
 */

import { FastifyRequest } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { devices } from '../db/schema.js';
import { parseDeviceLabel } from './device-label.js';

const FINGERPRINT_RE = /^[a-f0-9]{64}$/;

/** Extract and validate device fingerprint from request header. */
export function getFingerprint(request: FastifyRequest): string | null {
  const fp = request.headers['x-device-fingerprint'];
  if (typeof fp === 'string' && FINGERPRINT_RE.test(fp)) return fp;
  return null;
}

/** Validate a fingerprint string (exported for testing). */
export function isValidFingerprint(value: unknown): value is string {
  return typeof value === 'string' && FINGERPRINT_RE.test(value);
}

/** Find a device by user + fingerprint. */
export async function findDevice(userId: string, fingerprintHash: string) {
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.userId, userId), eq(devices.fingerprintHash, fingerprintHash)))
    .limit(1);
  return device ?? null;
}

/** Register a new device for a user. Returns the device row. */
export async function registerDevice(
  userId: string,
  fingerprintHash: string,
  ip: string,
  userAgent: string,
  trusted: boolean,
) {
  const label = parseDeviceLabel(userAgent);
  const [device] = await db
    .insert(devices)
    .values({ userId, fingerprintHash, label, lastIp: ip, trusted })
    .onConflictDoUpdate({
      target: [devices.userId, devices.fingerprintHash],
      set: { lastIp: ip, lastUsedAt: new Date(), label },
    })
    .returning();
  return device;
}

/** Update last_used_at and last_ip for an existing device. */
export async function touchDevice(deviceId: string, ip: string) {
  await db
    .update(devices)
    .set({ lastIp: ip, lastUsedAt: new Date() })
    .where(eq(devices.id, deviceId));
}

/** Mark a device as trusted (after MFA verification). */
export async function trustDevice(userId: string, fingerprintHash: string) {
  await db
    .update(devices)
    .set({ trusted: true, lastUsedAt: new Date() })
    .where(and(eq(devices.userId, userId), eq(devices.fingerprintHash, fingerprintHash)));
}

/**
 * Orchestrator: check device, register if new, touch if known.
 * Returns { isNew, isTrusted } for use in auth route logic.
 */
export async function handleDeviceCheck(
  userId: string,
  request: FastifyRequest,
): Promise<{ isNew: boolean; isTrusted: boolean }> {
  const fingerprint = getFingerprint(request);
  if (!fingerprint) return { isNew: false, isTrusted: false };

  const existing = await findDevice(userId, fingerprint);

  if (existing) {
    await touchDevice(existing.id, request.ip);
    return { isNew: false, isTrusted: existing.trusted };
  }

  // Device is new — register as untrusted (caller decides trust)
  await registerDevice(
    userId,
    fingerprint,
    request.ip,
    request.headers['user-agent'] ?? '',
    false,
  );
  return { isNew: true, isTrusted: false };
}

/** List all devices for a user (for settings page). */
export async function listDevices(userId: string) {
  return db.select().from(devices).where(eq(devices.userId, userId));
}

/** Remove a device. Returns true if deleted. */
export async function removeDevice(userId: string, deviceId: string): Promise<boolean> {
  const result = await db
    .delete(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
    .returning({ id: devices.id });
  return result.length > 0;
}
