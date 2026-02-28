/**
 * Scenario comparison engine for the financial simulator.
 *
 * Runs paired Monte Carlo iterations (same RNG seed per pair) for two
 * scenarios and computes the delta between them. Paired simulations
 * isolate the effect of scenario changes from stochastic market variation.
 *
 * All snapshot deltas are (alternative - baseline):
 *   positive netWorth/tspBalance/liquidSavings = alternative is better
 *   negative totalDebt = alternative has less debt (better)
 *
 * Summary metrics use intuitive signs:
 *   totalInterestSaved       — positive = money saved
 *   debtFreeMonthsEarlier    — positive = faster payoff
 *   additionalTSPAtRetirement — positive = more TSP
 *
 * Pure functions: no side effects, no DOM, no Zustand.
 */

import type {
  FinancialState,
  SimulationScenario,
  ComparisonDelta,
  DeltaSnapshot,
  MonthlySnapshot,
} from '@fortress/types';
import { buildSimInput, runSingleIteration, mulberry32 } from './simulator';
import { computePercentiles } from './aggregation';

// Year checkpoint indices (0-based)
const YEAR_1 = 11;
const YEAR_5 = 59;
const YEAR_10 = 119;
const YEAR_20 = 239;

/** Per-field delta arrays collected across iterations. */
interface DeltaCollector {
  netWorth: number[];
  tspBalance: number[];
  totalDebt: number[];
  liquidSavings: number[];
}

function emptyCollector(): DeltaCollector {
  return { netWorth: [], tspBalance: [], totalDebt: [], liquidSavings: [] };
}

/** Push delta values from a paired snapshot comparison into a collector. */
function collectDelta(
  alt: MonthlySnapshot,
  base: MonthlySnapshot,
  collector: DeltaCollector,
): void {
  collector.netWorth.push(alt.netWorth - base.netWorth);
  collector.tspBalance.push(alt.tspBalance - base.tspBalance);
  collector.totalDebt.push(alt.totalDebt - base.totalDebt);
  collector.liquidSavings.push(alt.liquidSavings - base.liquidSavings);
}

/** Aggregate collected deltas into a DeltaSnapshot with percentile bands. */
function buildDeltaSnapshot(c: DeltaCollector): DeltaSnapshot {
  return {
    netWorth: computePercentiles([...c.netWorth]),
    tspBalance: computePercentiles([...c.tspBalance]),
    totalDebt: computePercentiles([...c.totalDebt]),
    liquidSavings: computePercentiles([...c.liquidSavings]),
  };
}

/**
 * Compare two simulation scenarios using paired Monte Carlo iterations.
 *
 * @param state     Current financial state (shared starting point)
 * @param baseline  Reference scenario
 * @param alternative  Scenario being compared
 * @param onProgress   Optional progress callback (0-100)
 */
export function compareScenarios(
  state: FinancialState,
  baseline: SimulationScenario,
  alternative: SimulationScenario,
  onProgress?: (percent: number) => void,
): ComparisonDelta {
  const input = buildSimInput(state);
  const iterations = Math.min(baseline.iterations, alternative.iterations);
  const horizonMonths = Math.min(baseline.horizonMonths, alternative.horizonMonths);
  const baseSeed = 42;

  // Clamp year checkpoints to available horizon
  const y1 = Math.min(YEAR_1, horizonMonths - 1);
  const y5 = Math.min(YEAR_5, horizonMonths - 1);
  const y10 = Math.min(YEAR_10, horizonMonths - 1);
  const y20 = Math.min(YEAR_20, horizonMonths - 1);

  const collectors = {
    year1: emptyCollector(),
    year5: emptyCollector(),
    year10: emptyCollector(),
    year20: emptyCollector(),
  };

  const interestSaved: number[] = [];
  const debtFreeEarlier: number[] = [];
  const additionalTSP: number[] = [];

  // Weighted-average monthly interest rate for interest approximation
  const totalInitialDebt = input.initialDebts.reduce((s, d) => s + d.balance, 0);
  const avgMonthlyRate = totalInitialDebt > 0
    ? input.initialDebts.reduce((s, d) => s + d.apr * d.balance, 0)
      / totalInitialDebt / 100 / 12
    : 0;

  for (let i = 0; i < iterations; i++) {
    // Paired seeds: identical stochastic paths for fair comparison
    const baseSnaps = runSingleIteration(input, baseline, mulberry32(baseSeed + i));
    const altSnaps = runSingleIteration(input, alternative, mulberry32(baseSeed + i));

    // Year checkpoint deltas
    collectDelta(altSnaps[y1], baseSnaps[y1], collectors.year1);
    collectDelta(altSnaps[y5], baseSnaps[y5], collectors.year5);
    collectDelta(altSnaps[y10], baseSnaps[y10], collectors.year10);
    collectDelta(altSnaps[y20], baseSnaps[y20], collectors.year20);

    // Interest saved: integral of debt difference x average monthly rate
    let debtDiffSum = 0;
    for (let m = 0; m < horizonMonths; m++) {
      debtDiffSum += baseSnaps[m].totalDebt - altSnaps[m].totalDebt;
    }
    interestSaved.push(debtDiffSum * avgMonthlyRate);

    // Debt-free months earlier
    const baseFree = baseSnaps.findIndex((s) => s.totalDebt <= 0.01);
    const altFree = altSnaps.findIndex((s) => s.totalDebt <= 0.01);

    if (baseFree >= 0 && altFree >= 0) {
      debtFreeEarlier.push(baseFree - altFree);
    } else if (altFree >= 0) {
      // Alt achieves debt-free but baseline doesn't within horizon
      debtFreeEarlier.push(horizonMonths - altFree);
    } else if (baseFree >= 0) {
      // Baseline achieves debt-free but alt doesn't (alt is worse)
      debtFreeEarlier.push(-(horizonMonths - baseFree));
    } else {
      debtFreeEarlier.push(0);
    }

    // Additional TSP at end of horizon
    const lastIdx = horizonMonths - 1;
    additionalTSP.push(altSnaps[lastIdx].tspBalance - baseSnaps[lastIdx].tspBalance);

    if (onProgress && i % 10 === 9) {
      onProgress(Math.round(((i + 1) / iterations) * 100));
    }
  }

  return {
    year1: buildDeltaSnapshot(collectors.year1),
    year5: buildDeltaSnapshot(collectors.year5),
    year10: buildDeltaSnapshot(collectors.year10),
    year20: buildDeltaSnapshot(collectors.year20),
    totalInterestSaved: computePercentiles([...interestSaved]),
    debtFreeMonthsEarlier: computePercentiles([...debtFreeEarlier]),
    additionalTSPAtRetirement: computePercentiles([...additionalTSP]),
  };
}

/**
 * Run scenario comparison in a Web Worker (non-blocking).
 * Mirrors the runProjection() pattern from simulator.ts.
 */
export async function runComparisonProjection(
  state: FinancialState,
  baseline: SimulationScenario,
  alternative: SimulationScenario,
  onProgress?: (percent: number) => void,
): Promise<ComparisonDelta> {
  const worker = new Worker(
    new URL('./worker.ts', import.meta.url),
    { type: 'module' },
  );

  try {
    return await new Promise<ComparisonDelta>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;
        switch (msg.type) {
          case 'progress':
            onProgress?.(msg.percent);
            break;
          case 'result':
            resolve(msg.data as ComparisonDelta);
            break;
          case 'error':
            reject(new Error(msg.message));
            break;
        }
      };
      worker.onerror = (err) => {
        reject(new Error(err.message || 'Comparison worker failed'));
      };
      worker.postMessage({ type: 'compare', state, baseline, alternative });
    });
  } finally {
    worker.terminate();
  }
}
