import { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';

// --- In-memory cache (loaded once at startup) ---

interface TableCache {
  buffer: Buffer;
  hash: string;
  etag: string;
}

const bahCache = new Map<number, TableCache>();

function loadBahTable(year: number): TableCache | null {
  const filePath = path.resolve(process.cwd(), `data/pay-tables/bah-${year}.json`);
  try {
    const buffer = readFileSync(filePath);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const etag = `"${hash.slice(0, 16)}"`;
    return { buffer, hash, etag };
  } catch {
    return null;
  }
}

function getBahTable(year: number): TableCache | null {
  if (bahCache.has(year)) return bahCache.get(year)!;
  const table = loadBahTable(year);
  if (table) bahCache.set(year, table);
  return table;
}

// --- Routes ---

export async function tablesRoutes(app: FastifyInstance) {
  // Pre-warm the 2025 cache on startup
  getBahTable(2025);

  /**
   * GET /tables/bah/:year
   * Serves the full BAH table JSON for a given year.
   * Immutable caching — the data changes only when a new year is published.
   */
  app.get<{ Params: { year: string } }>(
    '/tables/bah/:year',
    async (request, reply) => {
      const year = parseInt(request.params.year, 10);

      if (isNaN(year) || year < 2020 || year > 2040) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid year parameter',
        });
      }

      const cached = getBahTable(year);
      if (!cached) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `BAH table for ${year} not available`,
        });
      }

      // Support conditional requests (304 Not Modified)
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch === cached.etag) {
        return reply.status(304).send();
      }

      return reply
        .header('Content-Type', 'application/json')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .header('ETag', cached.etag)
        .send(cached.buffer);
    },
  );

  /**
   * GET /tables/version
   * Returns version info (hash, year) for all available tables.
   * Short-lived cache so clients can check for updates.
   */
  app.get('/tables/version', async (_request, reply) => {
    const bah2025 = getBahTable(2025);

    const versions: Record<string, { year: number; hash: string; updatedAt: string }> = {};

    if (bah2025) {
      versions.bah = {
        year: 2025,
        hash: bah2025.hash,
        updatedAt: '2025-01-01',
      };
    }

    return reply
      .header('Cache-Control', 'public, max-age=3600')
      .send(versions);
  });
}
