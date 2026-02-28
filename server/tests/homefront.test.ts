import { describe, it, expect } from 'vitest';
import {
  validateInviteInput,
  validateAcceptInput,
  generateInviteToken,
  calculateInviteExpiry,
} from '../src/routes/homefront';
import { homefrontGrants } from '../src/db/schema';

// --- Schema tests ---

describe('homefrontGrants schema', () => {
  it('has required columns', () => {
    const columns = Object.keys(homefrontGrants);
    expect(columns).toContain('id');
    expect(columns).toContain('ownerId');
    expect(columns).toContain('spouseEmail');
    expect(columns).toContain('inviteToken');
    expect(columns).toContain('permission');
    expect(columns).toContain('spouseUserId');
    expect(columns).toContain('acceptedAt');
    expect(columns).toContain('revokedAt');
    expect(columns).toContain('expiresAt');
    expect(columns).toContain('createdAt');
  });

  it('has NO financial data columns', () => {
    const columns = Object.keys(homefrontGrants);
    const financialTerms = [
      'balance', 'income', 'salary', 'debt', 'savings',
      'basePay', 'bah', 'tsp', 'expense', 'ciphertext',
    ];
    for (const term of financialTerms) {
      const hasFinancial = columns.some((col) =>
        col.toLowerCase().includes(term.toLowerCase()),
      );
      expect(
        hasFinancial,
        `homefront_grants should not have column containing "${term}"`,
      ).toBe(false);
    }
  });

  it('references users via ownerId', () => {
    expect(Object.keys(homefrontGrants)).toContain('ownerId');
  });

  it('references users via spouseUserId', () => {
    expect(Object.keys(homefrontGrants)).toContain('spouseUserId');
  });
});

// --- validateInviteInput tests ---

describe('validateInviteInput', () => {
  it('accepts valid invite with read permission', () => {
    const result = validateInviteInput({
      spouseEmail: 'spouse@example.com',
      permission: 'read',
    });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.spouseEmail).toBe('spouse@example.com');
      expect(result.permission).toBe('read');
    }
  });

  it('accepts valid invite with write permission', () => {
    const result = validateInviteInput({
      spouseEmail: 'spouse@example.com',
      permission: 'write',
    });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.permission).toBe('write');
    }
  });

  it('defaults permission to read when omitted', () => {
    const result = validateInviteInput({ spouseEmail: 'spouse@example.com' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.permission).toBe('read');
    }
  });

  it('normalizes email to lowercase and trims', () => {
    const result = validateInviteInput({
      spouseEmail: '  Spouse@Example.COM  ',
      permission: 'read',
    });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.spouseEmail).toBe('spouse@example.com');
    }
  });

  it('rejects missing spouseEmail', () => {
    const result = validateInviteInput({ permission: 'read' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('spouseEmail');
    }
  });

  it('rejects invalid email (no @)', () => {
    const result = validateInviteInput({ spouseEmail: 'not-an-email' });
    expect('error' in result).toBe(true);
  });

  it('rejects invalid permission', () => {
    const result = validateInviteInput({
      spouseEmail: 'spouse@example.com',
      permission: 'admin',
    });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Permission');
    }
  });

  it('rejects empty object', () => {
    const result = validateInviteInput({});
    expect('error' in result).toBe(true);
  });
});

// --- validateAcceptInput tests ---

describe('validateAcceptInput', () => {
  function makeValidAccept() {
    return {
      inviteToken: 'abc123def456',
      email: 'spouse@example.com',
      password: 'securepass123',
    };
  }

  it('accepts valid accept input', () => {
    const result = validateAcceptInput(makeValidAccept());
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.inviteToken).toBe('abc123def456');
      expect(result.email).toBe('spouse@example.com');
      expect(result.password).toBe('securepass123');
    }
  });

  it('normalizes email to lowercase', () => {
    const result = validateAcceptInput({
      ...makeValidAccept(),
      email: '  Spouse@Example.COM  ',
    });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.email).toBe('spouse@example.com');
    }
  });

  it('rejects missing inviteToken', () => {
    const result = validateAcceptInput({
      email: 'spouse@example.com',
      password: 'securepass123',
    });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('inviteToken');
    }
  });

  it('rejects empty inviteToken', () => {
    const result = validateAcceptInput({
      ...makeValidAccept(),
      inviteToken: '',
    });
    expect('error' in result).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = validateAcceptInput({
      ...makeValidAccept(),
      email: 'not-valid',
    });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('email');
    }
  });

  it('rejects password shorter than 8 chars', () => {
    const result = validateAcceptInput({
      ...makeValidAccept(),
      password: 'short',
    });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('8 characters');
    }
  });

  it('rejects missing password', () => {
    const result = validateAcceptInput({
      inviteToken: 'abc123',
      email: 'spouse@example.com',
    });
    expect('error' in result).toBe(true);
  });
});

// --- Token generation tests ---

describe('generateInviteToken', () => {
  it('produces a 64-char hex string (32 bytes)', () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique tokens', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateInviteToken()));
    expect(tokens.size).toBe(10);
  });
});

describe('calculateInviteExpiry', () => {
  it('returns a date ~48 hours in the future', () => {
    const before = Date.now();
    const expiry = calculateInviteExpiry();
    const after = Date.now();

    const expectedMin = before + 48 * 60 * 60 * 1000;
    const expectedMax = after + 48 * 60 * 60 * 1000;

    expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiry.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it('returns a Date instance', () => {
    expect(calculateInviteExpiry()).toBeInstanceOf(Date);
  });
});
