/**
 * Fastify application factory.
 *
 * Extracted from index.ts so the app can be reused by:
 * - The standalone server (index.ts → app.listen())
 * - Vercel serverless function (api handler → app.ready())
 * - Tests that need a Fastify instance
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { config } from './config.js';
import { registerRateLimit } from './middleware/rate-limit.js';
import { authRoutes } from './routes/auth.js';
import { financialRoutes } from './routes/financial.js';
import { tablesRoutes } from './routes/tables.js';
import { homefrontRoutes } from './routes/homefront.js';
import { referralRoutes } from './routes/referral.js';
import { blackboxRoutes } from './routes/blackbox.js';

export async function buildApp() {
  const app = Fastify({
    logger: config.isDev
      ? { transport: { target: 'pino-pretty' } }
      : true,
  });

  await app.register(cors, {
    origin: config.isDev ? true : (process.env.VERCEL_URL
      ? [`https://${process.env.VERCEL_URL}`, config.clientOrigin]
      : config.clientOrigin),
    credentials: true,
  });

  await app.register(cookie);
  await registerRateLimit(app);

  app.get('/health', async () => ({ status: 'ok', env: config.env }));

  await app.register(authRoutes);
  await app.register(financialRoutes);
  await app.register(tablesRoutes);
  await app.register(homefrontRoutes);
  await app.register(referralRoutes);
  await app.register(blackboxRoutes);

  return app;
}
