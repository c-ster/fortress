import { describe, it, expect } from 'vitest';
import { users, encryptedSnapshots, refreshTokens, verificationCodes } from '../src/db/schema';

describe('Database Schema', () => {
  describe('Identity schema (Tier 4)', () => {
    it('users table has required columns', () => {
      const columns = Object.keys(users);
      expect(columns).toContain('id');
      expect(columns).toContain('email');
      expect(columns).toContain('passwordHash');
      expect(columns).toContain('milEmail');
      expect(columns).toContain('milVerified');
      expect(columns).toContain('mfaEnabled');
    });

    it('users table has NO financial data columns', () => {
      const columns = Object.keys(users);
      const financialTerms = [
        'balance',
        'income',
        'salary',
        'debt',
        'savings',
        'basePay',
        'bah',
        'tsp',
        'allotment',
        'expense',
      ];
      for (const term of financialTerms) {
        const hasFinancial = columns.some((col) => col.toLowerCase().includes(term.toLowerCase()));
        expect(hasFinancial, `users table should not have column containing "${term}"`).toBe(false);
      }
    });

    it('refresh tokens reference users', () => {
      expect(Object.keys(refreshTokens)).toContain('userId');
      expect(Object.keys(refreshTokens)).toContain('tokenHash');
      expect(Object.keys(refreshTokens)).toContain('expiresAt');
    });

    it('verification codes reference users', () => {
      expect(Object.keys(verificationCodes)).toContain('userId');
      expect(Object.keys(verificationCodes)).toContain('code');
      expect(Object.keys(verificationCodes)).toContain('email');
      expect(Object.keys(verificationCodes)).toContain('attempts');
    });
  });

  describe('Financial schema (Tier 2)', () => {
    it('encrypted_snapshots stores only encrypted data', () => {
      const columns = Object.keys(encryptedSnapshots);
      expect(columns).toContain('ciphertext');
      expect(columns).toContain('iv');
      expect(columns).toContain('authTag');
      expect(columns).toContain('salt');
      expect(columns).toContain('iterations');
      expect(columns).toContain('schemaVersion');
    });

    it('encrypted_snapshots has NO plaintext financial columns', () => {
      const columns = Object.keys(encryptedSnapshots);
      const plaintextTerms = [
        'income',
        'basePay',
        'bah',
        'debt',
        'savings',
        'balance',
        'expense',
        'tsp',
        'riskScore',
        'actionPlan',
      ];
      for (const term of plaintextTerms) {
        const hasPlaintext = columns.some((col) =>
          col.toLowerCase().includes(term.toLowerCase()),
        );
        expect(
          hasPlaintext,
          `encrypted_snapshots should not have plaintext column containing "${term}"`,
        ).toBe(false);
      }
    });

    it('encrypted_snapshots references users', () => {
      expect(Object.keys(encryptedSnapshots)).toContain('userId');
    });
  });
});
