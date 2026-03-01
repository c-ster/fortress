import { describe, it, expect } from 'vitest';
import {
  validateBlackBoxSave,
  generateAccessToken,
  hashAccessToken,
} from '../src/routes/blackbox.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validPayload() {
  return {
    ciphertext: Buffer.from('encrypted-data').toString('base64'),
    iv: Buffer.from('a'.repeat(12)).toString('base64'),
    authTag: Buffer.from('b'.repeat(16)).toString('base64'),
    salt: Buffer.from('c'.repeat(32)).toString('base64'),
    iterations: 600000,
    schemaVersion: 1,
    contactName: 'Jane Doe',
    contactEmail: 'jane@example.com',
  };
}

// ---------------------------------------------------------------------------
// validateBlackBoxSave
// ---------------------------------------------------------------------------

describe('validateBlackBoxSave', () => {
  it('accepts valid input without expiry', () => {
    const result = validateBlackBoxSave(validPayload());
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.contactName).toBe('Jane Doe');
      expect(result.contactEmail).toBe('jane@example.com');
      expect(result.expiresAt).toBeNull();
    }
  });

  it('accepts valid input with expiry', () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = validateBlackBoxSave({ ...validPayload(), expiresAt: future });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.expiresAt).toBeInstanceOf(Date);
    }
  });

  it('rejects missing ciphertext', () => {
    const input = { ...validPayload(), ciphertext: undefined };
    const result = validateBlackBoxSave(input);
    expect('error' in result).toBe(true);
  });

  it('rejects invalid IV length', () => {
    const input = { ...validPayload(), iv: Buffer.from('short').toString('base64') };
    const result = validateBlackBoxSave(input);
    expect('error' in result).toBe(true);
  });

  it('rejects invalid authTag length', () => {
    const input = { ...validPayload(), authTag: Buffer.from('short').toString('base64') };
    const result = validateBlackBoxSave(input);
    expect('error' in result).toBe(true);
  });

  it('rejects invalid salt length', () => {
    const input = { ...validPayload(), salt: Buffer.from('short').toString('base64') };
    const result = validateBlackBoxSave(input);
    expect('error' in result).toBe(true);
  });

  it('rejects missing contactName', () => {
    const input = { ...validPayload(), contactName: '' };
    const result = validateBlackBoxSave(input);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('contactName');
    }
  });

  it('rejects contactName over 100 chars', () => {
    const input = { ...validPayload(), contactName: 'x'.repeat(101) };
    const result = validateBlackBoxSave(input);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('contactName');
    }
  });

  it('rejects missing contactEmail', () => {
    const input = { ...validPayload(), contactEmail: 'invalid' };
    const result = validateBlackBoxSave(input);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('contactEmail');
    }
  });

  it('normalizes contactEmail to lowercase', () => {
    const input = { ...validPayload(), contactEmail: 'Jane@Example.COM' };
    const result = validateBlackBoxSave(input);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.contactEmail).toBe('jane@example.com');
    }
  });

  it('rejects past expiresAt', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const result = validateBlackBoxSave({ ...validPayload(), expiresAt: past });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('future');
    }
  });

  it('rejects non-string expiresAt', () => {
    const result = validateBlackBoxSave({ ...validPayload(), expiresAt: 12345 });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('expiresAt');
    }
  });

  it('rejects invalid date string for expiresAt', () => {
    const result = validateBlackBoxSave({ ...validPayload(), expiresAt: 'not-a-date' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('valid date');
    }
  });

  it('rejects invalid iterations', () => {
    const input = { ...validPayload(), iterations: 0 };
    const result = validateBlackBoxSave(input);
    expect('error' in result).toBe(true);
  });

  it('rejects invalid schemaVersion', () => {
    const input = { ...validPayload(), schemaVersion: -1 };
    const result = validateBlackBoxSave(input);
    expect('error' in result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateAccessToken
// ---------------------------------------------------------------------------

describe('generateAccessToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateAccessToken();
    expect(token).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
  });

  it('generates unique tokens', () => {
    const a = generateAccessToken();
    const b = generateAccessToken();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// hashAccessToken
// ---------------------------------------------------------------------------

describe('hashAccessToken', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const hash = hashAccessToken('test-token');
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
  });

  it('is deterministic', () => {
    const a = hashAccessToken('same-token');
    const b = hashAccessToken('same-token');
    expect(a).toBe(b);
  });

  it('differs for different inputs', () => {
    const a = hashAccessToken('token-a');
    const b = hashAccessToken('token-b');
    expect(a).not.toBe(b);
  });
});
