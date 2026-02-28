/**
 * Percentile computation and projection assembly for the simulator.
 *
 * Pure functions: no side effects, no DOM, no Zustand.
 */

import type { PercentileBand } from '@fortress/types';

/**
 * Compute a single percentile from a sorted array using nearest-rank method.
 */
function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Compute p10/p25/p50/p75/p90 from an unsorted array of values.
 * Sorts the array in-place for performance (caller should not reuse it).
 */
export function computePercentiles(values: number[]): PercentileBand {
  values.sort((a, b) => a - b);
  return {
    p10: percentile(values, 10),
    p25: percentile(values, 25),
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p90: percentile(values, 90),
  };
}

/** Per-month collected data from all iterations. */
export interface CollectedData {
  liquid: number[][];
  tsp: number[][];
  debt: number[][];
  netWorth: number[][];
  efMonths: number[][];
}

/**
 * Aggregate per-month iteration data into percentile projections.
 */
export function aggregateProjections(
  data: CollectedData,
  horizonMonths: number,
): {
  month: number;
  liquidSavings: PercentileBand;
  tspBalance: PercentileBand;
  totalDebt: PercentileBand;
  netWorth: PercentileBand;
  emergencyFundMonths: PercentileBand;
}[] {
  const projections = [];
  for (let m = 0; m < horizonMonths; m++) {
    projections.push({
      month: m + 1,
      liquidSavings: computePercentiles(data.liquid[m]),
      tspBalance: computePercentiles(data.tsp[m]),
      totalDebt: computePercentiles(data.debt[m]),
      netWorth: computePercentiles(data.netWorth[m]),
      emergencyFundMonths: computePercentiles(data.efMonths[m]),
    });
  }
  return projections;
}
