import { config } from '../config.js';
import * as schema from './schema.js';

// On Neon (Vercel), use HTTP-based driver (no sockets, no "family" bug).
// Locally, use standard pg.Pool for dev/test.
const isNeon = config.databaseUrl.includes('neon.tech');

let db: any; // eslint-disable-line @typescript-eslint/no-explicit-any
let pool: any; // eslint-disable-line @typescript-eslint/no-explicit-any

if (isNeon) {
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');
  const sql = neon(config.databaseUrl);
  db = drizzle(sql, { schema });
  pool = null; // No pool needed — HTTP queries
} else {
  const pg = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pgPool = new pg.default.Pool({
    connectionString: config.databaseUrl,
    max: 20,
  });
  db = drizzle(pgPool, { schema });
  pool = pgPool;
}

export { db, pool };
