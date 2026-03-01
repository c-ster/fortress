import crypto from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { auditLogs } from '../db/schema.js';

/** Fields used to compute the hash chain entry. */
export interface AuditEntry {
  sequence: number;
  userId: string | null;
  event: string;
  ip: string | null;
  userAgent: string | null;
  deviceFingerprint: string | null;
  details: string | null;
  previousHash: string | null;
  createdAt: string; // ISO-8601
}

/**
 * Compute SHA-256 hash of an audit entry.
 * Deterministic: uses a pipe-delimited canonical string.
 */
export function computeEntryHash(entry: AuditEntry): string {
  const canonical = [
    entry.sequence,
    entry.userId ?? '',
    entry.event,
    entry.details ?? '',
    entry.previousHash ?? '',
    entry.createdAt,
  ].join('|');

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Fetch the most recent audit entry for a given user (or global if null).
 * Returns the entryHash and sequence for chain linking.
 */
async function getLastAuditEntry(
  userId: string | null,
): Promise<{ entryHash: string; sequence: number } | null> {
  const condition = userId ? eq(auditLogs.userId, userId) : undefined;

  const rows = condition
    ? await db
        .select({ entryHash: auditLogs.entryHash, sequence: auditLogs.sequence })
        .from(auditLogs)
        .where(condition)
        .orderBy(desc(auditLogs.sequence))
        .limit(1)
    : await db
        .select({ entryHash: auditLogs.entryHash, sequence: auditLogs.sequence })
        .from(auditLogs)
        .orderBy(desc(auditLogs.sequence))
        .limit(1);

  return rows[0] ?? null;
}

/**
 * Insert a new audit log entry with hash chaining.
 * Fetches the previous entry, computes hashes, and inserts.
 */
export async function insertAuditLog(params: {
  userId: string | null;
  event: string;
  ip: string | null;
  userAgent: string | null;
  deviceFingerprint: string | null;
  details: Record<string, unknown> | null;
}): Promise<void> {
  const last = await getLastAuditEntry(params.userId);
  const sequence = last ? last.sequence + 1 : 1;
  const previousHash = last?.entryHash ?? null;
  const now = new Date();
  const detailsJson = params.details ? JSON.stringify(params.details) : null;

  const entry: AuditEntry = {
    sequence,
    userId: params.userId,
    event: params.event,
    ip: params.ip,
    userAgent: params.userAgent,
    deviceFingerprint: params.deviceFingerprint,
    details: detailsJson,
    previousHash,
    createdAt: now.toISOString(),
  };

  const entryHash = computeEntryHash(entry);

  await db.insert(auditLogs).values({
    sequence,
    userId: params.userId,
    event: params.event,
    ip: params.ip,
    userAgent: params.userAgent,
    deviceFingerprint: params.deviceFingerprint,
    details: detailsJson,
    previousHash,
    entryHash,
  });
}

/** Audit chain entry returned by verifyAuditChain. */
export interface ChainEntry {
  sequence: number;
  userId: string | null;
  event: string;
  details: string | null;
  previousHash: string | null;
  entryHash: string;
  createdAt: Date;
}

/**
 * Verify the integrity of the audit chain for a user (or global).
 * Returns true if all hashes are valid and chain links are correct.
 */
export async function verifyAuditChain(userId?: string): Promise<boolean> {
  const condition = userId ? eq(auditLogs.userId, userId) : undefined;

  const rows = condition
    ? await db.select().from(auditLogs).where(condition).orderBy(auditLogs.sequence)
    : await db.select().from(auditLogs).orderBy(auditLogs.sequence);

  let expectedPreviousHash: string | null = null;

  for (const row of rows) {
    // Check chain link
    if (row.previousHash !== expectedPreviousHash) {
      return false;
    }

    // Recompute and verify hash
    const entry: AuditEntry = {
      sequence: row.sequence,
      userId: row.userId,
      event: row.event,
      details: row.details,
      ip: row.ip,
      userAgent: row.userAgent,
      deviceFingerprint: row.deviceFingerprint,
      previousHash: row.previousHash,
      createdAt: row.createdAt.toISOString(),
    };

    const computed = computeEntryHash(entry);
    if (computed !== row.entryHash) {
      return false;
    }

    expectedPreviousHash = row.entryHash;
  }

  return true;
}
