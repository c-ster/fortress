import { FastifyRequest } from 'fastify';
import { insertAuditLog } from '../services/audit.js';

export interface AuditDetails {
  userId?: string;
  deviceFingerprint?: string | null;
  newDevice?: boolean;
  [key: string]: unknown;
}

export function auditLog(event: string, request: FastifyRequest, details?: AuditDetails) {
  const ip = request.ip;
  const userAgent = (request.headers['user-agent'] as string) ?? null;
  const deviceFingerprint =
    (request.headers['x-device-fingerprint'] as string) ?? null;
  const userId = details?.userId ?? null;

  // Keep console/pino logging
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip,
    userAgent,
    deviceFingerprint,
    ...details,
  };
  request.log.info(logEntry, `audit: ${event}`);

  // Build extra details — strip fields that are already top-level columns
  const extraDetails: Record<string, unknown> = {};
  if (details) {
    for (const [key, value] of Object.entries(details)) {
      if (key !== 'userId' && key !== 'deviceFingerprint') {
        extraDetails[key] = value;
      }
    }
  }

  // Fire-and-forget DB persistence — never block the request
  insertAuditLog({
    userId,
    event,
    ip,
    userAgent,
    deviceFingerprint,
    details: Object.keys(extraDetails).length > 0 ? extraDetails : null,
  }).catch(() => {
    // Silently swallow — audit write failure must not break user requests
  });
}
