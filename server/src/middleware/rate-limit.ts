import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: false,
  });
}

export const authRateLimitConfig = {
  max: config.rateLimit.auth,
  timeWindow: '1 minute',
  keyGenerator: (request: { ip: string }) => request.ip,
};

export const sessionRateLimitConfig = {
  max: config.rateLimit.session,
  timeWindow: '1 minute',
  keyGenerator: (request: { ip: string }) => request.ip,
};
