/**
 * Tests for session hardening utilities.
 *
 * Tests pure functions: isSessionActive.
 * Also validates config values and rate limit configs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isSessionActive } from '../src/services/session.js';
import { config } from '../src/config.js';

describe('isSessionActive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when lastUsedAt is recent', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    // 5 minutes ago — well within 30-min idle timeout
    const lastUsedAt = new Date(now.getTime() - 5 * 60 * 1000);
    expect(isSessionActive(lastUsedAt)).toBe(true);
  });

  it('returns true when lastUsedAt is exactly at the threshold', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    // Exactly at idle timeout (default 1800 seconds)
    const lastUsedAt = new Date(now.getTime() - config.sessionIdleTimeout * 1000);
    expect(isSessionActive(lastUsedAt)).toBe(true);
  });

  it('returns false when lastUsedAt exceeds idle timeout', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    // 1 second past the idle timeout
    const lastUsedAt = new Date(now.getTime() - (config.sessionIdleTimeout + 1) * 1000);
    expect(isSessionActive(lastUsedAt)).toBe(false);
  });

  it('returns false when lastUsedAt is hours old', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const lastUsedAt = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
    expect(isSessionActive(lastUsedAt)).toBe(false);
  });

  it('returns true when lastUsedAt is now', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    expect(isSessionActive(now)).toBe(true);
  });

  it('returns true when lastUsedAt is 29 minutes ago (just under threshold)', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const lastUsedAt = new Date(now.getTime() - 29 * 60 * 1000);
    expect(isSessionActive(lastUsedAt)).toBe(true);
  });

  it('returns false when lastUsedAt is 31 minutes ago (just over threshold)', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const lastUsedAt = new Date(now.getTime() - 31 * 60 * 1000);
    expect(isSessionActive(lastUsedAt)).toBe(false);
  });
});

describe('session config values', () => {
  it('has a sessionIdleTimeout of 1800 seconds (30 min) by default', () => {
    expect(config.sessionIdleTimeout).toBe(1800);
  });

  it('has a session rate limit of 30 by default', () => {
    expect(config.rateLimit.session).toBe(30);
  });

  it('has an auth rate limit configured', () => {
    expect(config.rateLimit.auth).toBeGreaterThan(0);
  });
});

describe('sessionRateLimitConfig', () => {
  it('exports a valid rate limit config', async () => {
    const { sessionRateLimitConfig } = await import('../src/middleware/rate-limit.js');
    expect(sessionRateLimitConfig).toHaveProperty('max');
    expect(sessionRateLimitConfig).toHaveProperty('timeWindow');
    expect(sessionRateLimitConfig).toHaveProperty('keyGenerator');
    expect(sessionRateLimitConfig.max).toBe(30);
    expect(sessionRateLimitConfig.timeWindow).toBe('1 minute');
  });

  it('keyGenerator returns request IP', async () => {
    const { sessionRateLimitConfig } = await import('../src/middleware/rate-limit.js');
    expect(sessionRateLimitConfig.keyGenerator({ ip: '10.0.0.1' })).toBe('10.0.0.1');
  });
});
