#!/usr/bin/env node
/**
 * Load test runner — exercises critical API endpoints with Autocannon.
 *
 * Usage:
 *   npx tsx server/src/load-test/run.ts                    # default localhost:3001
 *   npx tsx server/src/load-test/run.ts --url http://host  # custom target
 *
 * Requires a running server with database. Not run in CI — manual only.
 * Exits with code 1 if any scenario's p99 exceeds the degraded threshold.
 */

import autocannon from 'autocannon';
import { THRESHOLDS, SCENARIOS, type EndpointScenario } from './config.js';

const baseUrl = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:3001';

interface ScenarioResult {
  name: string;
  requests: number;
  avgLatencyMs: number;
  p50Ms: number;
  p99Ms: number;
  reqPerSec: number;
  errors: number;
  pass: boolean;
}

async function runScenario(scenario: EndpointScenario): Promise<ScenarioResult> {
  const url = `${baseUrl}${scenario.path}`;

  const opts: autocannon.Options = {
    url,
    method: scenario.method,
    duration: scenario.duration,
    connections: scenario.connections,
    headers: scenario.headers,
    ...(scenario.body ? { body: JSON.stringify(scenario.body) } : {}),
  };

  const result = await autocannon(opts);

  return {
    name: scenario.name,
    requests: result.requests.total,
    avgLatencyMs: result.latency.average,
    p50Ms: result.latency.p50,
    p99Ms: result.latency.p99,
    reqPerSec: result.requests.average,
    errors: result.errors,
    pass: result.latency.p99 <= THRESHOLDS.degradedResponseMs,
  };
}

function printResult(r: ScenarioResult) {
  const status = r.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`\n  ${status}  ${r.name}`);
  console.log(`         Requests: ${r.requests} total, ${r.reqPerSec.toFixed(1)} req/sec`);
  console.log(`         Latency:  avg=${r.avgLatencyMs.toFixed(1)}ms  p50=${r.p50Ms}ms  p99=${r.p99Ms}ms`);
  if (r.errors > 0) {
    console.log(`         Errors:   ${r.errors}`);
  }
}

async function main() {
  console.log(`\n  Fortress Load Test`);
  console.log(`  Target: ${baseUrl}`);
  console.log(`  Thresholds: p99 < ${THRESHOLDS.degradedResponseMs}ms (degraded), target < ${THRESHOLDS.apiResponseMs}ms`);
  console.log(`  ${'─'.repeat(60)}`);

  const results: ScenarioResult[] = [];
  let allPassed = true;

  for (const scenario of SCENARIOS) {
    try {
      const result = await runScenario(scenario);
      results.push(result);
      printResult(result);
      if (!result.pass) allPassed = false;
    } catch (err) {
      console.log(`\n  \x1b[31mERROR\x1b[0m  ${scenario.name}: ${err}`);
      allPassed = false;
    }
  }

  console.log(`\n  ${'─'.repeat(60)}`);
  console.log(`  ${results.length} scenarios run`);
  console.log(`  ${results.filter((r) => r.pass).length} passed, ${results.filter((r) => !r.pass).length} failed`);
  console.log(`  Overall: ${allPassed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}\n`);

  process.exit(allPassed ? 0 : 1);
}

main();
