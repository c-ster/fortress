import { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users, refreshTokens, verificationCodes } from '../db/schema.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
  type JwtPayload,
} from '../middleware/auth.js';
import { authRateLimitConfig } from '../middleware/rate-limit.js';
import { auditLog } from '../middleware/audit-log.js';
import { sendEmail, generateVerificationCode } from '../services/email.js';
import { generateMfaSecret, verifyMfaToken } from '../services/mfa.js';
import {
  getFingerprint,
  registerDevice,
  handleDeviceCheck,
  trustDevice,
} from '../services/device.js';

interface AuthenticatedRequest {
  user: JwtPayload;
}

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post(
    '/auth/register',
    { config: { rateLimit: authRateLimitConfig } },
    async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };

      if (!email || !password || password.length < 8) {
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: 'Email and password (8+ chars) required' });
      }

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        return reply.status(409).send({ error: 'Conflict', message: 'Email already registered' });
      }

      const passwordHash = await argon2.hash(password);
      const [user] = await db
        .insert(users)
        .values({ email, passwordHash })
        .returning({ id: users.id, email: users.email });

      // Register device as trusted (registering device is implicitly trusted)
      const fingerprint = getFingerprint(request);
      if (fingerprint) {
        await registerDevice(
          user.id, fingerprint, request.ip,
          request.headers['user-agent'] ?? '', true,
        );
      }

      auditLog('register', request, { userId: user.id, deviceFingerprint: fingerprint });

      const accessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        mfaVerified: false,
      });
      const refresh = signRefreshToken(user.id);
      const refreshHash = crypto.createHash('sha256').update(refresh).digest('hex');

      await db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      reply.setCookie('refreshToken', refresh, {
        httpOnly: true,
        secure: !app.listeningOrigin?.startsWith('http://localhost'),
        sameSite: 'strict',
        path: '/auth/session',
        maxAge: 7 * 24 * 60 * 60,
      });

      return reply.status(201).send({
        accessToken,
        expiresIn: 900,
        user: { id: user.id, email: user.email },
      });
    },
  );

  // POST /auth/login
  app.post(
    '/auth/login',
    { config: { rateLimit: authRateLimitConfig } },
    async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
      }

      const valid = await argon2.verify(user.passwordHash, password);
      if (!valid) {
        auditLog('login_failed', request, { userId: user.id });
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
      }

      // Device fingerprint check
      const deviceResult = await handleDeviceCheck(user.id, request);

      if (user.mfaEnabled) {
        const tempToken = signAccessToken({
          userId: user.id,
          email: user.email,
          mfaVerified: false,
        });
        auditLog('login_mfa_pending', request, {
          userId: user.id,
          newDevice: deviceResult.isNew,
        });
        return reply.send({
          requiresMfa: true,
          accessToken: tempToken,
          expiresIn: 900,
          knownDevice: !deviceResult.isNew,
        });
      }

      // No MFA — auto-trust new devices
      if (deviceResult.isNew) {
        const fp = getFingerprint(request);
        if (fp) await trustDevice(user.id, fp);
      }

      auditLog('login', request, {
        userId: user.id,
        newDevice: deviceResult.isNew,
      });

      const accessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        mfaVerified: true,
      });
      const refresh = signRefreshToken(user.id);
      const refreshHash = crypto.createHash('sha256').update(refresh).digest('hex');

      await db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      reply.setCookie('refreshToken', refresh, {
        httpOnly: true,
        secure: !app.listeningOrigin?.startsWith('http://localhost'),
        sameSite: 'strict',
        path: '/auth/session',
        maxAge: 7 * 24 * 60 * 60,
      });

      return reply.send({
        accessToken,
        expiresIn: 900,
        ...(deviceResult.isNew && { newDevice: true }),
      });
    },
  );

  // POST /auth/session (refresh)
  app.post('/auth/session', async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'No refresh token' });
    }

    let payload: { userId: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, payload.userId),
          eq(refreshTokens.tokenHash, tokenHash),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!stored) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Refresh token revoked' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
    }

    // Track device on session refresh
    await handleDeviceCheck(user.id, request);

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      mfaVerified: !user.mfaEnabled,
    });

    return reply.send({ accessToken, expiresIn: 900 });
  });

  // POST /auth/verify-email (.mil verification)
  app.post('/auth/verify-email', { preHandler: [requireAuth] }, async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const { email: milEmail } = request.body as { email: string };

    if (!milEmail?.endsWith('.mil')) {
      return reply
        .status(400)
        .send({ error: 'Bad Request', message: 'Must be a .mil email address' });
    }

    const code = generateVerificationCode();

    await db.insert(verificationCodes).values({
      userId: user.userId,
      code,
      email: milEmail,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await sendEmail({
      to: milEmail,
      subject: 'Fortress — Verify Your .mil Email',
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    });

    auditLog('mil_verification_sent', request, { userId: user.userId });
    return reply.send({ message: 'Verification code sent' });
  });

  // POST /auth/verify-code
  app.post('/auth/verify-code', { preHandler: [requireAuth] }, async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const { code } = request.body as { code: string };

    const [record] = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.userId, user.userId),
          gt(verificationCodes.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!record) {
      return reply
        .status(400)
        .send({ error: 'Bad Request', message: 'No pending verification or code expired' });
    }

    if (record.attempts >= 3) {
      return reply
        .status(429)
        .send({ error: 'Too Many Requests', message: 'Max attempts reached. Request a new code.' });
    }

    await db
      .update(verificationCodes)
      .set({ attempts: record.attempts + 1 })
      .where(eq(verificationCodes.id, record.id));

    if (record.code !== code) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid code' });
    }

    await db
      .update(users)
      .set({ milEmail: record.email, milVerified: true, updatedAt: new Date() })
      .where(eq(users.id, user.userId));

    await db.delete(verificationCodes).where(eq(verificationCodes.userId, user.userId));

    auditLog('mil_verified', request, { userId: user.userId });
    return reply.send({ message: 'Email verified', milEmail: record.email });
  });

  // POST /auth/mfa/setup
  app.post('/auth/mfa/setup', { preHandler: [requireAuth] }, async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const { secret, uri } = generateMfaSecret();

    await db
      .update(users)
      .set({
        mfaSecretEncrypted: Buffer.from(secret, 'utf-8'),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.userId));

    auditLog('mfa_setup_started', request, { userId: user.userId });
    return reply.send({ secret, uri });
  });

  // POST /auth/mfa/verify
  app.post(
    '/auth/mfa/verify',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { token } = request.body as { token: string };

      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.userId))
        .limit(1);

      if (!dbUser?.mfaSecretEncrypted) {
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: 'MFA not set up. Call /auth/mfa/setup first.' });
      }

      const secret = dbUser.mfaSecretEncrypted.toString('utf-8');
      const valid = verifyMfaToken(secret, token);

      if (!valid) {
        auditLog('mfa_verify_failed', request, { userId: user.userId });
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid MFA token' });
      }

      if (!dbUser.mfaEnabled) {
        await db
          .update(users)
          .set({ mfaEnabled: true, updatedAt: new Date() })
          .where(eq(users.id, user.userId));
      }

      // Trust device after successful MFA verification
      const fingerprint = getFingerprint(request);
      if (fingerprint) {
        await trustDevice(user.userId, fingerprint);
      }

      const accessToken = signAccessToken({
        userId: user.userId,
        email: user.email,
        mfaVerified: true,
      });

      auditLog('mfa_verified', request, {
        userId: user.userId,
        deviceFingerprint: fingerprint,
      });
      return reply.send({ accessToken, expiresIn: 900 });
    },
  );
}
