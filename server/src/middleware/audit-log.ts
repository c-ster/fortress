import { FastifyRequest } from 'fastify';

export function auditLog(event: string, request: FastifyRequest, details?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    ...details,
  };
  request.log.info(entry, `audit: ${event}`);
}
