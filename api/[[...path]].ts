/**
 * Vercel serverless catch-all function.
 *
 * Wraps the Fastify application so all /api/* requests are handled
 * by the same server code used in standalone mode.
 *
 * The client calls /api/auth/login → this function strips /api prefix
 * → Fastify sees /auth/login (matching its registered routes).
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance | null = null;
let initError: Error | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (initError) throw initError;
  if (!app) {
    try {
      const { buildApp } = await import('../server/src/app.js');
      app = await buildApp();
      await app.ready();
    } catch (err) {
      initError = err instanceof Error ? err : new Error(String(err));
      throw initError;
    }
  }
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const fastify = await getApp();

    // Strip /api prefix so Fastify routes match (e.g. /api/auth/login → /auth/login)
    if (req.url?.startsWith('/api')) {
      req.url = req.url.slice(4) || '/';
    }

    fastify.server.emit('request', req, res);
  } catch (err) {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Function init failed', detail: message }));
  }
}
