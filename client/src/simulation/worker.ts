/**
 * Web Worker for the financial path simulator.
 *
 * Runs the Monte Carlo simulation off the main thread to avoid blocking UI.
 * Follows the same message protocol pattern as les-worker.ts.
 *
 * Inbound:  { type: 'run', state: FinancialState, scenario: SimulationScenario }
 * Outbound: { type: 'progress', percent: number }
 *         | { type: 'result', data: SimulationResult }
 *         | { type: 'error', message: string }
 */

import type { FinancialState, SimulationScenario } from '@fortress/types';
import { runSimulation } from './simulator';

function post(data: unknown): void {
  self.postMessage(data);
}

self.onmessage = (event: MessageEvent<{ type: string; state: FinancialState; scenario: SimulationScenario }>) => {
  const { type, state, scenario } = event.data;
  if (type !== 'run') return;

  try {
    const result = runSimulation(state, scenario, (percent) => {
      post({ type: 'progress', percent });
    });
    post({ type: 'result', data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Simulation failed';
    post({ type: 'error', message });
  }
};
