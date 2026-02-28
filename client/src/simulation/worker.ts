/**
 * Web Worker for the financial path simulator.
 *
 * Runs simulation and comparison off the main thread to avoid blocking UI.
 * Follows the same message protocol pattern as les-worker.ts.
 *
 * Inbound:  { type: 'run', state, scenario }
 *         | { type: 'compare', state, baseline, alternative }
 * Outbound: { type: 'progress', percent: number }
 *         | { type: 'result', data: SimulationResult | ComparisonDelta }
 *         | { type: 'error', message: string }
 */

import type { FinancialState, SimulationScenario } from '@fortress/types';
import { runSimulation } from './simulator';
import { compareScenarios } from './comparison';

function post(data: unknown): void {
  self.postMessage(data);
}

function onProgress(percent: number): void {
  post({ type: 'progress', percent });
}

self.onmessage = (event: MessageEvent) => {
  const { type } = event.data;

  if (type === 'run') {
    const { state, scenario } = event.data as {
      state: FinancialState;
      scenario: SimulationScenario;
    };
    try {
      const result = runSimulation(state, scenario, onProgress);
      post({ type: 'result', data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      post({ type: 'error', message });
    }
  } else if (type === 'compare') {
    const { state, baseline, alternative } = event.data as {
      state: FinancialState;
      baseline: SimulationScenario;
      alternative: SimulationScenario;
    };
    try {
      const result = compareScenarios(state, baseline, alternative, onProgress);
      post({ type: 'result', data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Comparison failed';
      post({ type: 'error', message });
    }
  }
};
