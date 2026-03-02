/**
 * Homefront Link routes.
 *
 * Lets a deployed service member share encrypted financial snapshot
 * access with their spouse/partner. Server never decrypts data.
 *
 * Endpoints:
 *   POST   /homefront/invite   — Owner creates invite
 *   POST   /homefront/accept   — Spouse accepts invite + creates account
 *   GET    /homefront/snapshot  — Spouse reads owner's encrypted snapshot
 *   POST   /homefront/snapshot  — Spouse writes owner's encrypted snapshot (if write perm)
 *   DELETE /homefront/grant     — Owner revokes spouse access
 *   GET    /homefront/status    — Owner or spouse checks grant status
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import argon2 from 'argon2';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/connection.js';
import { users, homefrontGrants, encryptedSnapshots, refreshTokens } from '../db/schema.js';
import { requireAuth, signAccessToken, signRefreshToken, type JwtPayload } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit-log.js';
import { validateAndConvertPayload } from './financial.js';
import type { EncryptedPayload } from '@fortress/types';

interface AuthenticatedRequest {
  user: JwtPayload;
}

// --- Validation helpers (exported for testing) ---

const INVITE_EXPIRY_HOURS = 48;
const VALID_PERMISSIONS = ['read', 'write'] as const;

export type HomefrontPermission = (typeof VALID_PERMISSIONS)[number];

export function validateInviteInput(
  body: unknown,
): { spouseEmail: string; permission: HomefrontPermission } | { error: string } {
  const data = body as Record<string, unknown>;

  if (typeof data.spouseEmail !== 'string' || !data.spouseEmail.includes('@')) {
    return { error: 'Valid spouseEmail required' };
  }

  const permission = (data.permission ?? 'read') as string;
  if (!VALID_PERMISSIONS.includes(permission as HomefrontPermission)) {
    return { error: `Permission must be one of: ${VALID_PERMISSIONS.join(', ')}` };
  }

  return { spouseEmail: data.spouseEmail.trim().toLowerCase(), permission: permission as HomefrontPermission };
}

export function validateAcceptInput(
  body: unknown,
): { inviteToken: string; email: string; password: string } | { error: string } {
  const data = body as Record<string, unknown>;

  if (typeof data.inviteToken !== 'string' || data.inviteToken.length === 0) {
    return { error: 'inviteToken required' };
  }
  if (typeof data.email !== 'string' || !data.email.includes('@')) {
    return { error: 'Valid email required' };
  }
  if (typeof data.password !== 'string' || data.password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  return {
    inviteToken: data.inviteToken,
    email: data.email.trim().toLowerCase(),
    password: data.password,
  };
}

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function calculateInviteExpiry(): Date {
  return new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
}

// --- Routes ---

export async function homefrontRoutes(app: FastifyInstance) {
  // POST /homefront/invite — Owner creates an invite for spouse
  app.post(
    '/homefront/invite',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const input = validateInviteInput(request.body);

      if ('error' in input) {
        return reply.status(400).send({ error: 'Bad Request', message: input.error });
      }

      if (input.spouseEmail === user.email) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Cannot invite yourself',
        });
      }

      // Revoke any existing active grant for this owner
      await db
        .update(homefrontGrants)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(homefrontGrants.ownerId, user.userId),
            isNull(homefrontGrants.revokedAt),
          ),
        );

      const inviteToken = generateInviteToken();
      const expiresAt = calculateInviteExpiry();

      await db.insert(homefrontGrants).values({
        ownerId: user.userId,
        spouseEmail: input.spouseEmail,
        inviteToken,
        permission: input.permission,
        expiresAt,
      });

      auditLog('homefront_invite_created', request, {
        userId: user.userId,
        spouseEmail: input.spouseEmail,
        permission: input.permission,
      });

      return reply.status(201).send({ inviteToken, expiresAt: expiresAt.toISOString() });
    },
  );

  // POST /homefront/accept — Spouse accepts invite + creates account
  app.post('/homefront/accept', async (request, reply) => {
    const input = validateAcceptInput(request.body);

    if ('error' in input) {
      return reply.status(400).send({ error: 'Bad Request', message: input.error });
    }

    // Find the grant by token
    const [grant] = await db
      .select()
      .from(homefrontGrants)
      .where(eq(homefrontGrants.inviteToken, input.inviteToken))
      .limit(1);

    if (!grant) {
      return reply.status(404).send({ error: 'Not Found', message: 'Invalid invite token' });
    }

    if (grant.revokedAt) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invite has been revoked' });
    }

    if (grant.acceptedAt) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invite already accepted' });
    }

    if (grant.expiresAt < new Date()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invite has expired' });
    }

    // Check if email is already registered
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({ error: 'Conflict', message: 'Email already registered' });
    }

    // Create spouse account
    const passwordHash = await argon2.hash(input.password);
    const [spouseUser] = await db
      .insert(users)
      .values({ email: input.email, passwordHash })
      .returning({ id: users.id, email: users.email });

    // Link grant to spouse
    await db
      .update(homefrontGrants)
      .set({ spouseUserId: spouseUser.id, acceptedAt: new Date() })
      .where(eq(homefrontGrants.id, grant.id));

    // Issue tokens
    const accessToken = signAccessToken({
      userId: spouseUser.id,
      email: spouseUser.email,
      mfaVerified: false,
    });
    const refresh = signRefreshToken(spouseUser.id);
    const refreshHash = crypto.createHash('sha256').update(refresh).digest('hex');

    await db.insert(refreshTokens).values({
      userId: spouseUser.id,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    reply.setCookie('refreshToken', refresh, {
      httpOnly: true,
      secure: !config.isDev,
      sameSite: 'strict',
      path: '/auth/session',
      maxAge: 7 * 24 * 60 * 60,
    });

    auditLog('homefront_invite_accepted', request, {
      grantId: grant.id,
      spouseUserId: spouseUser.id,
    });

    return reply.status(201).send({
      accessToken,
      expiresIn: 900,
      user: { id: spouseUser.id, email: spouseUser.email },
    });
  });

  // GET /homefront/snapshot — Spouse reads owner's encrypted snapshot
  app.get(
    '/homefront/snapshot',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;

      const grant = await resolveSpouseGrant(user.userId);
      if (!grant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'No active homefront grant found',
        });
      }

      const [snapshot] = await db
        .select()
        .from(encryptedSnapshots)
        .where(eq(encryptedSnapshots.userId, grant.ownerId))
        .limit(1);

      if (!snapshot) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'No financial snapshot found for owner',
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

      auditLog('homefront_snapshot_read', request, {
        spouseUserId: user.userId,
        ownerId: grant.ownerId,
      });

      return reply.send(payload);
    },
  );

  // POST /homefront/snapshot — Spouse writes to owner's snapshot (write perm only)
  app.post(
    '/homefront/snapshot',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;

      const grant = await resolveSpouseGrant(user.userId);
      if (!grant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'No active homefront grant found',
        });
      }

      if (grant.permission !== 'write') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Write permission required',
        });
      }

      const result = validateAndConvertPayload(request.body);
      if ('error' in result) {
        return reply.status(400).send({ error: 'Bad Request', message: result.error });
      }

      await db
        .insert(encryptedSnapshots)
        .values({
          userId: grant.ownerId,
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

      auditLog('homefront_snapshot_written', request, {
        spouseUserId: user.userId,
        ownerId: grant.ownerId,
      });

      return reply.status(200).send({ message: 'Snapshot saved' });
    },
  );

  // DELETE /homefront/grant — Owner revokes spouse access
  app.delete(
    '/homefront/grant',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;

      const [grant] = await db
        .select()
        .from(homefrontGrants)
        .where(
          and(
            eq(homefrontGrants.ownerId, user.userId),
            isNull(homefrontGrants.revokedAt),
          ),
        )
        .limit(1);

      if (!grant) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'No active grant found',
        });
      }

      await db
        .update(homefrontGrants)
        .set({ revokedAt: new Date() })
        .where(eq(homefrontGrants.id, grant.id));

      auditLog('homefront_grant_revoked', request, {
        userId: user.userId,
        grantId: grant.id,
      });

      return reply.status(200).send({ message: 'Access revoked' });
    },
  );

  // GET /homefront/status — Owner or spouse checks grant status
  app.get(
    '/homefront/status',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;

      // Check as owner first
      const [ownerGrant] = await db
        .select()
        .from(homefrontGrants)
        .where(
          and(
            eq(homefrontGrants.ownerId, user.userId),
            isNull(homefrontGrants.revokedAt),
          ),
        )
        .limit(1);

      if (ownerGrant) {
        return reply.send({
          role: 'owner',
          grant: {
            spouseEmail: ownerGrant.spouseEmail,
            permission: ownerGrant.permission,
            accepted: !!ownerGrant.acceptedAt,
            active: !ownerGrant.revokedAt && ownerGrant.expiresAt > new Date(),
            expiresAt: ownerGrant.expiresAt.toISOString(),
            createdAt: ownerGrant.createdAt.toISOString(),
          },
        });
      }

      // Check as spouse
      const spouseGrant = await resolveSpouseGrant(user.userId);
      if (spouseGrant) {
        // Fetch owner email
        const [owner] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, spouseGrant.ownerId))
          .limit(1);

        return reply.send({
          role: 'spouse',
          grant: {
            ownerEmail: owner?.email ?? 'unknown',
            permission: spouseGrant.permission,
            active: true,
          },
        });
      }

      return reply.send({ role: null, grant: null });
    },
  );
}

// --- Helper ---

/** Resolve an accepted, non-revoked grant where the user is the spouse. */
async function resolveSpouseGrant(spouseUserId: string) {
  const [grant] = await db
    .select()
    .from(homefrontGrants)
    .where(
      and(
        eq(homefrontGrants.spouseUserId, spouseUserId),
        isNotNull(homefrontGrants.acceptedAt),
        isNull(homefrontGrants.revokedAt),
      ),
    )
    .limit(1);

  if (!grant) return null;

  // Check expiry on the grant's parent invite (accepted grants stay valid)
  // Once accepted, access is valid until revoked — no expiry check
  return grant;
}
