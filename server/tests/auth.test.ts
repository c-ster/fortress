import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../src/middleware/auth';
import { generateVerificationCode } from '../src/services/email';
import { generateMfaSecret, verifyMfaToken } from '../src/services/mfa';

describe('Auth middleware', () => {
  const testPayload = { userId: 'test-uuid', email: 'test@example.com', mfaVerified: false };

  it('signs and verifies access tokens', () => {
    const token = signAccessToken(testPayload);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(testPayload.userId);
    expect(decoded.email).toBe(testPayload.email);
    expect(decoded.mfaVerified).toBe(false);
  });

  it('signs and verifies refresh tokens', () => {
    const token = signRefreshToken('test-uuid');
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe('test-uuid');
  });

  it('rejects tampered access tokens', () => {
    const token = signAccessToken(testPayload);
    expect(() => verifyAccessToken(token + 'tampered')).toThrow();
  });

  it('rejects tampered refresh tokens', () => {
    const token = signRefreshToken('test-uuid');
    expect(() => verifyRefreshToken(token + 'x')).toThrow();
  });
});

describe('Email service', () => {
  it('generates 6-digit verification codes', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code, 10)).toBeLessThan(1000000);
    }
  });
});

describe('MFA service', () => {
  it('generates a secret and URI', () => {
    const { secret, uri } = generateMfaSecret();
    expect(secret).toBeTruthy();
    expect(secret.length).toBeGreaterThan(10);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('Fortress');
  });

  it('verifies a valid TOTP token', () => {
    const { secret } = generateMfaSecret();
    // Generate a current valid token using the same library
    const OTPAuth = require('otpauth');
    const totp = new OTPAuth.TOTP({
      issuer: 'Fortress',
      label: 'Fortress Financial',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const validToken = totp.generate();

    expect(verifyMfaToken(secret, validToken)).toBe(true);
  });

  it('rejects an invalid TOTP token', () => {
    const { secret } = generateMfaSecret();
    expect(verifyMfaToken(secret, '000000')).toBe(false);
    expect(verifyMfaToken(secret, '999999')).toBe(false);
  });
});
