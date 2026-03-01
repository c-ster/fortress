/**
 * Tests for device fingerprinting services.
 *
 * Tests the pure functions: parseDeviceLabel and isValidFingerprint.
 * DB-dependent functions (findDevice, registerDevice, etc.) are tested
 * implicitly through manual QA and future integration tests.
 */

import { describe, it, expect } from 'vitest';
import { parseDeviceLabel } from '../src/services/device-label.js';
import { isValidFingerprint } from '../src/services/device.js';

describe('parseDeviceLabel', () => {
  it('parses Chrome on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseDeviceLabel(ua)).toBe('Chrome 120 on macOS');
  });

  it('parses Chrome on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
    expect(parseDeviceLabel(ua)).toBe('Chrome 119 on Windows');
  });

  it('parses Firefox on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120';
    expect(parseDeviceLabel(ua)).toBe('Firefox 120 on Windows');
  });

  it('parses Firefox on Linux', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115';
    expect(parseDeviceLabel(ua)).toBe('Firefox 115 on Linux');
  });

  it('parses Safari on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15';
    expect(parseDeviceLabel(ua)).toBe('Safari 17 on macOS');
  });

  it('parses Edge on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    expect(parseDeviceLabel(ua)).toBe('Edge 120 on Windows');
  });

  it('parses Chrome on Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36';
    expect(parseDeviceLabel(ua)).toBe('Chrome 120 on Android');
  });

  it('parses Safari on iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Mobile/15E148 Safari/604.1';
    expect(parseDeviceLabel(ua)).toBe('Safari 17 on iOS');
  });

  it('returns "Unknown device" for empty string', () => {
    expect(parseDeviceLabel('')).toBe('Unknown device');
  });

  it('returns "Unknown device" for unrecognized user agent', () => {
    expect(parseDeviceLabel('curl/7.64.1')).toBe('Unknown device');
  });

  it('returns partial label when only browser is detected', () => {
    const ua = 'Chrome/120';
    expect(parseDeviceLabel(ua)).toBe('Chrome 120 on Unknown OS');
  });

  it('returns partial label when only OS is detected', () => {
    const ua = 'Some App (Macintosh; Intel Mac OS X 10_15_7)';
    expect(parseDeviceLabel(ua)).toBe('Unknown browser on macOS');
  });
});

describe('isValidFingerprint', () => {
  it('accepts a valid 64-char hex string', () => {
    const fp = 'a'.repeat(64);
    expect(isValidFingerprint(fp)).toBe(true);
  });

  it('accepts mixed hex characters', () => {
    const fp = 'abcdef0123456789'.repeat(4);
    expect(isValidFingerprint(fp)).toBe(true);
  });

  it('rejects uppercase hex', () => {
    const fp = 'A'.repeat(64);
    expect(isValidFingerprint(fp)).toBe(false);
  });

  it('rejects non-hex characters', () => {
    const fp = 'g'.repeat(64);
    expect(isValidFingerprint(fp)).toBe(false);
  });

  it('rejects too-short strings', () => {
    const fp = 'a'.repeat(63);
    expect(isValidFingerprint(fp)).toBe(false);
  });

  it('rejects too-long strings', () => {
    const fp = 'a'.repeat(65);
    expect(isValidFingerprint(fp)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidFingerprint('')).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidFingerprint(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidFingerprint(undefined)).toBe(false);
  });

  it('rejects numbers', () => {
    expect(isValidFingerprint(12345)).toBe(false);
  });

  it('rejects strings with spaces', () => {
    const fp = 'a'.repeat(32) + ' ' + 'b'.repeat(31);
    expect(isValidFingerprint(fp)).toBe(false);
  });
});
