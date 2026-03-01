import { FastifyRequest } from 'fastify';

export interface AuditDetails {
  userId?: string;
  deviceFingerprint?: string | null;
  newDevice?: boolean;
  [key: string]: unknown;
}

export function auditLog(event: string, request: FastifyRequest, details?: AuditDetails) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    deviceFingerprint: request.headers['x-device-fingerprint'] ?? null,
    ...details,
  };
  request.log.info(entry, `audit: ${event}`);
}
