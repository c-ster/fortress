import { describe, it, expect } from 'vitest';
import { validateAndConvertPayload } from '../src/routes/financial';

// Valid Base64-encoded test values with correct byte lengths
// IV: 12 bytes → 16 Base64 chars
const VALID_IV = Buffer.from(new Uint8Array(12).fill(1)).toString('base64');
// Auth tag: 16 bytes → 24 Base64 chars
const VALID_AUTH_TAG = Buffer.from(new Uint8Array(16).fill(2)).toString('base64');
// Salt: 32 bytes → 44 Base64 chars
const VALID_SALT = Buffer.from(new Uint8Array(32).fill(3)).toString('base64');
// Ciphertext: arbitrary length
const VALID_CIPHERTEXT = Buffer.from('encrypted-financial-data-here').toString('base64');

function makeValidPayload() {
  return {
    ciphertext: VALID_CIPHERTEXT,
    iv: VALID_IV,
    authTag: VALID_AUTH_TAG,
    salt: VALID_SALT,
    iterations: 600_000,
    schemaVersion: 1,
  };
}

describe('validateAndConvertPayload', () => {
  it('accepts a valid payload and converts Base64 to Buffers', () => {
    const result = validateAndConvertPayload(makeValidPayload());
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(Buffer.isBuffer(result.ciphertext)).toBe(true);
      expect(Buffer.isBuffer(result.iv)).toBe(true);
      expect(Buffer.isBuffer(result.authTag)).toBe(true);
      expect(Buffer.isBuffer(result.salt)).toBe(true);
      expect(result.iterations).toBe(600_000);
      expect(result.schemaVersion).toBe(1);
    }
  });

  it('validates Buffer sizes after conversion', () => {
    const result = validateAndConvertPayload(makeValidPayload());
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.iv.length).toBe(12);
      expect(result.authTag.length).toBe(16);
      expect(result.salt.length).toBe(32);
    }
  });

  it('round-trips Base64 correctly', () => {
    const result = validateAndConvertPayload(makeValidPayload());
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      // Converting back to base64 should produce the original input
      expect(result.iv.toString('base64')).toBe(VALID_IV);
      expect(result.authTag.toString('base64')).toBe(VALID_AUTH_TAG);
      expect(result.salt.toString('base64')).toBe(VALID_SALT);
      expect(result.ciphertext.toString('base64')).toBe(VALID_CIPHERTEXT);
    }
  });

  describe('rejects missing fields', () => {
    const requiredStrings = ['ciphertext', 'iv', 'authTag', 'salt'] as const;

    for (const field of requiredStrings) {
      it(`rejects missing ${field}`, () => {
        const payload = makeValidPayload();
        delete (payload as Record<string, unknown>)[field];
        const result = validateAndConvertPayload(payload);
        expect('error' in result).toBe(true);
        if ('error' in result) {
          expect(result.error).toContain(field);
        }
      });

      it(`rejects empty string ${field}`, () => {
        const payload = { ...makeValidPayload(), [field]: '' };
        const result = validateAndConvertPayload(payload);
        expect('error' in result).toBe(true);
      });
    }
  });

  describe('rejects invalid iterations', () => {
    it('rejects zero iterations', () => {
      const payload = { ...makeValidPayload(), iterations: 0 };
      const result = validateAndConvertPayload(payload);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('iterations');
      }
    });

    it('rejects negative iterations', () => {
      const payload = { ...makeValidPayload(), iterations: -1 };
      const result = validateAndConvertPayload(payload);
      expect('error' in result).toBe(true);
    });

    it('rejects non-integer iterations', () => {
      const payload = { ...makeValidPayload(), iterations: 1.5 };
      const result = validateAndConvertPayload(payload);
      expect('error' in result).toBe(true);
    });
  });

  describe('rejects invalid schema version', () => {
    it('rejects zero schemaVersion', () => {
      const payload = { ...makeValidPayload(), schemaVersion: 0 };
      const result = validateAndConvertPayload(payload);
      expect('error' in result).toBe(true);
    });

    it('rejects non-integer schemaVersion', () => {
      const payload = { ...makeValidPayload(), schemaVersion: 1.5 };
      const result = validateAndConvertPayload(payload);
      expect('error' in result).toBe(true);
    });
  });

  describe('rejects wrong byte sizes', () => {
    it('rejects IV that is not 12 bytes', () => {
      const wrongIv = Buffer.from(new Uint8Array(8).fill(1)).toString('base64');
      const payload = { ...makeValidPayload(), iv: wrongIv };
      const result = validateAndConvertPayload(payload);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('IV length');
      }
    });

    it('rejects auth tag that is not 16 bytes', () => {
      const wrongTag = Buffer.from(new Uint8Array(8).fill(2)).toString('base64');
      const payload = { ...makeValidPayload(), authTag: wrongTag };
      const result = validateAndConvertPayload(payload);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('auth tag length');
      }
    });

    it('rejects salt that is not 32 bytes', () => {
      const wrongSalt = Buffer.from(new Uint8Array(16).fill(3)).toString('base64');
      const payload = { ...makeValidPayload(), salt: wrongSalt };
      const result = validateAndConvertPayload(payload);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('salt length');
      }
    });
  });
});
