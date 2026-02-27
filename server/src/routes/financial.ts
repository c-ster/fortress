import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { encryptedSnapshots } from '../db/schema.js';
import { requireAuth, type JwtPayload } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit-log.js';
import type { EncryptedPayload } from '@fortress/types';

interface AuthenticatedRequest {
  user: JwtPayload;
}

// --- Validation ---

export interface ConvertedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  salt: Buffer;
  iterations: number;
  schemaVersion: number;
}

export function validateAndConvertPayload(
  body: unknown,
): ConvertedPayload | { error: string } {
  const payload = body as Record<string, unknown>;

  // Required fields check
  const requiredStrings = ['ciphertext', 'iv', 'authTag', 'salt'] as const;
  for (const field of requiredStrings) {
    if (typeof payload[field] !== 'string' || (payload[field] as string).length === 0) {
      return { error: `Missing or invalid field: ${field}` };
    }
  }

  if (!Number.isInteger(payload.iterations) || (payload.iterations as number) < 1) {
    return { error: 'Invalid iterations count' };
  }

  if (!Number.isInteger(payload.schemaVersion) || (payload.schemaVersion as number) < 1) {
    return { error: 'Invalid schema version' };
  }

  // Base64 → Buffer conversion
  let ciphertext: Buffer;
  let iv: Buffer;
  let authTag: Buffer;
  let salt: Buffer;

  try {
    ciphertext = Buffer.from(payload.ciphertext as string, 'base64');
    iv = Buffer.from(payload.iv as string, 'base64');
    authTag = Buffer.from(payload.authTag as string, 'base64');
    salt = Buffer.from(payload.salt as string, 'base64');
  } catch {
    return { error: 'Invalid Base64 encoding in payload fields' };
  }

  // Size validation
  if (iv.length !== 12) {
    return { error: `Invalid IV length: expected 12 bytes, got ${iv.length}` };
  }
  if (authTag.length !== 16) {
    return { error: `Invalid auth tag length: expected 16 bytes, got ${authTag.length}` };
  }
  if (salt.length !== 32) {
    return { error: `Invalid salt length: expected 32 bytes, got ${salt.length}` };
  }

  return {
    ciphertext,
    iv,
    authTag,
    salt,
    iterations: payload.iterations as number,
    schemaVersion: payload.schemaVersion as number,
  };
}

// --- Routes ---

export async function financialRoutes(app: FastifyInstance) {
  // POST /financial/snapshot — save encrypted financial state
  app.post(
    '/financial/snapshot',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const result = validateAndConvertPayload(request.body);

      if ('error' in result) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: result.error,
        });
      }

      // Upsert — one snapshot per user (enforced by unique constraint on userId)
      await db
        .insert(encryptedSnapshots)
        .values({
          userId: user.userId,
          ciphertext: result.ciphertext,
          iv: result.iv,
          authTag: result.authTag,
          salt: result.salt,
          iterations: result.iterations,
          schemaVersion: result.schemaVersion,
        })
        .onConflictDoUpdate({
          target: encryptedSnapshots.userId,
          set: {
            ciphertext: result.ciphertext,
            iv: result.iv,
            authTag: result.authTag,
            salt: result.salt,
            iterations: result.iterations,
            schemaVersion: result.schemaVersion,
            updatedAt: new Date(),
          },
        });

      auditLog('snapshot_saved', request, { userId: user.userId });
      return reply.status(200).send({ message: 'Snapshot saved' });
    },
  );

  // GET /financial/snapshot — load encrypted financial state
  app.get(
    '/financial/snapshot',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;

      const [snapshot] = await db
        .select()
        .from(encryptedSnapshots)
        .where(eq(encryptedSnapshots.userId, user.userId))
        .limit(1);

      if (!snapshot) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'No financial snapshot found',
        });
      }

      const payload: EncryptedPayload = {
        ciphertext: snapshot.ciphertext.toString('base64'),
        iv: snapshot.iv.toString('base64'),
        authTag: snapshot.authTag.toString('base64'),
        salt: snapshot.salt.toString('base64'),
        iterations: snapshot.iterations,
        schemaVersion: snapshot.schemaVersion,
      };

      return reply.send(payload);
    },
  );
}
