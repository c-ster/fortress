/**
 * Tests for load test configuration.
 *
 * Validates that performance thresholds match README spec
 * and endpoint scenarios are well-formed.
 */

import { describe, it, expect } from 'vitest';
import { THRESHOLDS, SCENARIOS } from '../src/load-test/config.js';

describe('performance thresholds', () => {
  it('nominal API response target is 200ms', () => {
    expect(THRESHOLDS.apiResponseMs).toBe(200);
  });

  it('degraded API response target is 500ms', () => {
    expect(THRESHOLDS.degradedResponseMs).toBe(500);
  });

  it('concurrent user target is 1000', () => {
    expect(THRESHOLDS.concurrentUsers).toBe(1000);
  });

  it('uptime target is 99.9%', () => {
    expect(THRESHOLDS.uptime).toBe(0.999);
  });
});

describe('load test scenarios', () => {
  it('has at least 3 scenarios', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(3);
  });

  it('every scenario has required fields', () => {
    for (const s of SCENARIOS) {
      expect(typeof s.name).toBe('string');
      expect(s.name.length).toBeGreaterThan(0);
      expect(['GET', 'POST', 'DELETE']).toContain(s.method);
      expect(s.path).toMatch(/^\//);
      expect(s.duration).toBeGreaterThan(0);
      expect(s.connections).toBeGreaterThan(0);
    }
  });

  it('includes a health check scenario', () => {
    const health = SCENARIOS.find((s) => s.path === '/health');
    expect(health).toBeDefined();
    expect(health!.method).toBe('GET');
  });

  it('includes an auth scenario', () => {
    const auth = SCENARIOS.find((s) => s.path.startsWith('/auth'));
    expect(auth).toBeDefined();
  });

  it('includes a tables scenario', () => {
    const tables = SCENARIOS.find((s) => s.path.startsWith('/tables'));
    expect(tables).toBeDefined();
  });

  it('POST scenarios with body include Content-Type header', () => {
    for (const s of SCENARIOS) {
      if (s.body) {
        expect(s.headers?.['Content-Type']).toBe('application/json');
      }
    }
  });
});
