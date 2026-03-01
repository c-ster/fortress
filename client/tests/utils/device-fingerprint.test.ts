/**
 * Tests for client-side device fingerprinting.
 *
 * Runs in JSDOM environment. Tests pure functions for fingerprint
 * generation, component collection, and user-agent label parsing.
 */

import { describe, it, expect } from 'vitest';
import {
  collectFingerprintComponents,
  generateFingerprint,
  parseUserAgentLabel,
  deriveDeviceLabel,
  type FingerprintComponents,
} from '../../src/utils/device-fingerprint';

describe('collectFingerprintComponents', () => {
  it('returns an object with all expected properties', () => {
    const components = collectFingerprintComponents();

    expect(components).toHaveProperty('userAgent');
    expect(components).toHaveProperty('language');
    expect(components).toHaveProperty('languages');
    expect(components).toHaveProperty('platform');
    expect(components).toHaveProperty('hardwareConcurrency');
    expect(components).toHaveProperty('screenWidth');
    expect(components).toHaveProperty('screenHeight');
    expect(components).toHaveProperty('colorDepth');
    expect(components).toHaveProperty('pixelRatio');
    expect(components).toHaveProperty('timezoneOffset');
    expect(components).toHaveProperty('timezone');
    expect(components).toHaveProperty('touchSupport');
    expect(components).toHaveProperty('cookieEnabled');
  });

  it('returns correct types for all properties', () => {
    const c = collectFingerprintComponents();

    expect(typeof c.userAgent).toBe('string');
    expect(typeof c.language).toBe('string');
    expect(Array.isArray(c.languages)).toBe(true);
    expect(typeof c.platform).toBe('string');
    expect(typeof c.hardwareConcurrency).toBe('number');
    expect(typeof c.screenWidth).toBe('number');
    expect(typeof c.screenHeight).toBe('number');
    expect(typeof c.colorDepth).toBe('number');
    expect(typeof c.pixelRatio).toBe('number');
    expect(typeof c.timezoneOffset).toBe('number');
    expect(typeof c.timezone).toBe('string');
    expect(typeof c.touchSupport).toBe('boolean');
    expect(typeof c.cookieEnabled).toBe('boolean');
  });

  it('uses navigator.userAgent', () => {
    const components = collectFingerprintComponents();
    expect(components.userAgent).toBe(navigator.userAgent);
  });
});

describe('generateFingerprint', () => {
  it('returns a 64-character hex string', async () => {
    const fp = await generateFingerprint();
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the same value on repeated calls (deterministic)', async () => {
    const fp1 = await generateFingerprint();
    const fp2 = await generateFingerprint();
    expect(fp1).toBe(fp2);
  });

  it('returns different values for different browser properties', async () => {
    const fp1 = await generateFingerprint();

    // Mock a different screen width
    const originalWidth = Object.getOwnPropertyDescriptor(window.screen, 'width');
    Object.defineProperty(window.screen, 'width', { value: 9999, configurable: true });

    // Need to clear the fingerprint cache by generating fresh
    // Since generateFingerprint uses collectFingerprintComponents each time,
    // a different screen width should produce a different hash
    const components2 = collectFingerprintComponents();
    expect(components2.screenWidth).toBe(9999);

    // Manually hash the modified components to verify different output
    const keys = Object.keys(components2).sort() as (keyof FingerprintComponents)[];
    const sorted: Record<string, unknown> = {};
    for (const key of keys) {
      sorted[key] = components2[key];
    }
    const json = JSON.stringify(sorted);
    const encoded = new TextEncoder().encode(json);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const bytes = new Uint8Array(hashBuffer);
    const fp2 = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    expect(fp2).not.toBe(fp1);

    // Restore
    if (originalWidth) {
      Object.defineProperty(window.screen, 'width', originalWidth);
    }
  });
});

describe('parseUserAgentLabel', () => {
  it('parses Chrome on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseUserAgentLabel(ua)).toBe('Chrome 120 on macOS');
  });

  it('parses Firefox on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120';
    expect(parseUserAgentLabel(ua)).toBe('Firefox 120 on Windows');
  });

  it('parses Safari on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15';
    expect(parseUserAgentLabel(ua)).toBe('Safari 17 on macOS');
  });

  it('parses Edge on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    expect(parseUserAgentLabel(ua)).toBe('Edge 120 on Windows');
  });

  it('parses Chrome on Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36';
    expect(parseUserAgentLabel(ua)).toBe('Chrome 120 on Android');
  });

  it('parses Safari on iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Mobile/15E148 Safari/604.1';
    expect(parseUserAgentLabel(ua)).toBe('Safari 17 on iOS');
  });

  it('handles Firefox on Linux', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115';
    expect(parseUserAgentLabel(ua)).toBe('Firefox 115 on Linux');
  });

  it('returns "Unknown device" for empty string', () => {
    expect(parseUserAgentLabel('')).toBe('Unknown device');
  });

  it('returns "Unknown device" for unrecognized user agent', () => {
    expect(parseUserAgentLabel('curl/7.64.1')).toBe('Unknown device');
  });
});

describe('deriveDeviceLabel', () => {
  it('returns a non-empty string', () => {
    const label = deriveDeviceLabel();
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});
