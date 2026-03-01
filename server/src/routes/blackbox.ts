/**
 * Black Box routes.
 *
 * Encrypted emergency financial sheet for next-of-kin access.
 * Server stores encrypted blobs only — cannot decrypt.
 *
 * Endpoints:
 *   POST   /blackbox              — Owner saves/updates Black Box
 *   GET    /blackbox              — Owner retrieves their Black Box
 *   DELETE /blackbox              — Owner deletes their Black Box
 *   GET    /blackbox/access/:token — Emergency contact retrieves by access token
 *   GET    /blackbox/status       — Owner checks grant status
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { blackBoxSnapshots } from '../db/schema.js';
import { requireAuth, type JwtPayload } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit-log.js';
import { validateAndConvertPayload, type ConvertedPayload } from './financial.js';

interface AuthenticatedRequest {
  user: JwtPayload;
}

// --- Helpers (exported for testing) ---

export function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface BlackBoxSaveInput {
  payload: ConvertedPayload;
  contactName: string;
  contactEmail: string;
  expiresAt: Date | null;
}

export function validateBlackBoxSave(
  body: unknown,
): BlackBoxSaveInput | { error: string } {
  const data = body as Record<string, unknown>;

  // Validate encrypted payload fields
  const payloadResult = validateAndConvertPayload(data);
  if ('error' in payloadResult) {
    return payloadResult;
  }

  // Validate contact info
  if (typeof data.contactName !== 'string' || data.contactName.trim().length === 0) {
    return { error: 'contactName is required' };
  }
  if (data.contactName.trim().length > 100) {
    return { error: 'contactName must be 100 characters or fewer' };
  }

  if (typeof data.contactEmail !== 'string' || !data.contactEmail.includes('@')) {
    return { error: 'Valid contactEmail is required' };
  }
  if (data.contactEmail.trim().length > 254) {
    return { error: 'contactEmail is too long' };
  }

  // Optional expiry
  let expiresAt: Date | null = null;
  if (data.expiresAt != null) {
    if (typeof data.expiresAt !== 'string') {
      return { error: 'expiresAt must be an ISO date string' };
    }
    const parsed = new Date(data.expiresAt);
    if (isNaN(parsed.getTime())) {
      return { error: 'expiresAt is not a valid date' };
    }
    if (parsed <= new Date()) {
      return { error: 'expiresAt must be in the future' };
    }
    expiresAt = parsed;
  }

  return {
    payload: payloadResult,
    contactName: data.contactName.trim(),
    contactEmail: data.contactEmail.trim().toLowerCase(),
    expiresAt,
  };
}

// --- Routes ---

export async function blackboxRoutes(app: FastifyInstance) {
  // POST /blackbox — Owner saves encrypted Black Box
  app.post(
    '/blackbox',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const result = validateBlackBoxSave(request.body);

      if ('error' in result) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: result.error,
        });
      }

      const accessToken = generateAccessToken();
      const tokenHash = hashAccessToken(accessToken);

      await db
        .insert(blackBoxSnapshots)
        .values({
          userId: user.userId,
          ciphertext: result.payload.ciphertext,
          iv: result.payload.iv,
          authTag: result.payload.authTag,
          salt: result.payload.salt,
          iterations: result.payload.iterations,
          schemaVersion: result.payload.schemaVersion,
          contactName: result.contactName,
          contactEmail: result.contactEmail,
          accessTokenHash: tokenHash,
          expiresAt: result.expiresAt,
        })
        .onConflictDoUpdate({
          target: blackBoxSnapshots.userId,
          set: {
            ciphertext: result.payload.ciphertext,
            iv: result.payload.iv,
            authTag: result.payload.authTag,
            salt: result.payload.salt,
            iterations: result.payload.iterations,
            schemaVersion: result.payload.schemaVersion,
            contactName: result.contactName,
            contactEmail: result.contactEmail,
            accessTokenHash: tokenHash,
            expiresAt: result.expiresAt,
            updatedAt: new Date(),
          },
        });

      auditLog('blackbox_saved', request, { userId: user.userId });

      return reply.status(200).send({ accessToken });
    },
  );

  // GET /blackbox — Owner retrieves their encrypted Black Box
  app.get(
    '/blackbox',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;

      const [snapshot] = await db
        .select()
        .from(blackBoxSnapshots)
        .where(eq(blackBoxSnapshots.userId, user.userId))
        .limit(1);

      if (!snapshot) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'No Black Box found',
        });
      }

      return reply.send({
        ciphertext: snapshot.ciphertext.toString('base64'),
        iv: snapshot.iv.toString('base64'),
        authTag: snapshot.authTag.toString('base64'),
        salt: snapshot.salt.toString('base64'),
        iterations: snapshot.iterations,
        schemaVersion: snapshot.schemaVersion,
      });
    },
  );

  // DELETE /blackbox — Owner deletes their Black Box
  app.delete(
    '/blackbox',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;

      const deleted = await db
        .delete(blackBoxSnapshots)
        .where(eq(blackBoxSnapshots.userId, user.userId))
        .returning({ id: blackBoxSnapshots.id });

      if (deleted.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'No Black Box found',
        });
      }

      auditLog('blackbox_deleted', request, { userId: user.userId });
      return reply.status(200).send({ message: 'Black Box deleted' });
    },
  );

  // GET /blackbox/access/:token — Emergency contact retrieves by access token
  // NO auth required — the token IS the authorization
  app.get('/blackbox/access/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

    if (!token || token.length !== 64) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid access token format',
      });
    }

    const tokenHash = hashAccessToken(token);

    const [snapshot] = await db
      .select()
      .from(blackBoxSnapshots)
      .where(eq(blackBoxSnapshots.accessTokenHash, tokenHash))
      .limit(1);

    if (!snapshot) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Black Box not found or access revoked',
      });
    }

    // Check expiry
    if (snapshot.expiresAt && snapshot.expiresAt < new Date()) {
      return reply.status(410).send({
        error: 'Gone',
        message: 'This Black Box has expired',
      });
    }

    auditLog('blackbox_accessed', request, {
      blackBoxId: snapshot.id,
      contactEmail: snapshot.contactEmail,
    });

    return reply.send({
      ciphertext: snapshot.ciphertext.toString('base64'),
      iv: snapshot.iv.toString('base64'),
      authTag: snapshot.authTag.toString('base64'),
      salt: snapshot.salt.toString('base64'),
      iterations: snapshot.iterations,
      schemaVersion: snapshot.schemaVersion,
    });
  });

  // GET /blackbox/status — Owner checks grant status
  app.get(
    '/blackbox/status',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;

      const [snapshot] = await db
        .select({
          contactName: blackBoxSnapshots.contactName,
          contactEmail: blackBoxSnapshots.contactEmail,
          expiresAt: blackBoxSnapshots.expiresAt,
          createdAt: blackBoxSnapshots.createdAt,
          updatedAt: blackBoxSnapshots.updatedAt,
        })
        .from(blackBoxSnapshots)
        .where(eq(blackBoxSnapshots.userId, user.userId))
        .limit(1);

      if (!snapshot) {
        return reply.send({
          exists: false,
          contactName: null,
          contactEmail: null,
          expiresAt: null,
          createdAt: null,
          updatedAt: null,
        });
      }

      return reply.send({
        exists: true,
        contactName: snapshot.contactName,
        contactEmail: snapshot.contactEmail,
        expiresAt: snapshot.expiresAt?.toISOString() ?? null,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
      });
    },
  );
}
