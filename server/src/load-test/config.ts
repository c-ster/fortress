/**
 * Load test configuration — performance thresholds and endpoint definitions.
 *
 * Thresholds sourced from README.md Section 15 performance matrix.
 */

/** Performance thresholds from the README spec. */
export const THRESHOLDS = {
  /** Nominal API response target (milliseconds). */
  apiResponseMs: 200,
  /** Degraded but acceptable response target (milliseconds). */
  degradedResponseMs: 500,
  /** Concurrent users at launch. */
  concurrentUsers: 1000,
  /** Uptime target (fraction). */
  uptime: 0.999,
} as const;

/** Load test endpoint definition. */
export interface EndpointScenario {
  name: string;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** Duration of the test in seconds. */
  duration: number;
  /** Number of concurrent connections. */
  connections: number;
}

/** Default scenarios targeting the critical server endpoints. */
export const SCENARIOS: EndpointScenario[] = [
  {
    name: 'Health check (baseline)',
    method: 'GET',
    path: '/health',
    duration: 10,
    connections: 100,
  },
  {
    name: 'BAH table (cached, large response)',
    method: 'GET',
    path: '/tables/bah/2025',
    duration: 10,
    connections: 100,
  },
  {
    name: 'BAH version (metadata)',
    method: 'GET',
    path: '/tables/version',
    duration: 10,
    connections: 100,
  },
  {
    name: 'Auth login (Argon2 + DB)',
    method: 'POST',
    path: '/auth/login',
    body: { email: 'loadtest@example.com', password: 'loadtest123' },
    headers: { 'Content-Type': 'application/json' },
    duration: 10,
    connections: 50,
  },
  {
    name: 'Auth session refresh (token rotation)',
    method: 'POST',
    path: '/auth/session',
    duration: 10,
    connections: 50,
  },
];
