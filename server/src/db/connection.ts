import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.js';
import * as schema from './schema.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 20,
});

export const db = drizzle(pool, { schema });
export { pool };
