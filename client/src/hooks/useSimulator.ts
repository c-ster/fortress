/**
 * Custom hook managing simulator scenario state, debounced simulation execution,
 * preview mode (50 iterations during slider drag), and comparison mode.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SimulationScenario, SimulationResult, ComparisonDelta } from '@fortress/types';
import { useFinancialStore } from '../stores/financial-state';
import { runProjection } from '../simulation/simulator';
import { runComparisonProjection } from '../simulation/comparison';

// --- Default Scenario ---

const FULL_ITERATIONS = 500;
const PREVIEW_ITERATIONS = 50;
const DEBOUNCE_MS = 300;

export function buildDefaultScenario(tspPct: number): SimulationScenario {
  return {
    tspContributionPct: tspPct > 0 ? tspPct : 0.05,
    monthlySavingsAllotment: 200,
    debtStrategy: 'avalanche',
    extraDebtPayment: 0,
    housingChoice: 'at_bah',
    bahDelta: 0,
    lifestyleAdjustmentPct: 0,
    horizonMonths: 480,
    iterations: FULL_ITERATIONS,
    tspReturnMean: 0.07,
    tspReturnStdDev: 0.15,
    savingsReturnMean: 0.04,
  };
}

/** Merge partial scenario updates, preserving iteration count. */
export function mergeScenario(
  current: SimulationScenario,
  partial: Partial<SimulationScenario>,
): SimulationScenario {
  return { ...current, ...partial };
}

// --- Hook ---

export function useSimulator() {
  const financialState = useFinancialStore((s) => s.state);
  const tspPct = financialState.deductions.tspContributionPct;

  const [scenario, setScenario] = useState<SimulationScenario>(
    () => buildDefaultScenario(tspPct),
  );
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [comparison, setComparison] = useState<ComparisonDelta | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [baselineScenario, setBaselineScenario] = useState<SimulationScenario | null>(null);

  // Track the latest run ID to discard stale results
  const runIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Run simulation (or comparison if baseline is set)
  const runSim = useCallback(
    async (scen: SimulationScenario) => {
      const id = ++runIdRef.current;
      setIsRunning(true);
      setProgress(0);

      try {
        const simResult = await runProjection(financialState, scen, (p) => {
          if (runIdRef.current === id) setProgress(p);
        });
        if (runIdRef.current !== id) return; // stale
        setResult(simResult);

        // Run comparison if baseline is locked
        if (baselineScenario) {
          const delta = await runComparisonProjection(
            financialState,
            baselineScenario,
            scen,
            (p) => {
              if (runIdRef.current === id) setProgress(p);
            },
          );
          if (runIdRef.current === id) setComparison(delta);
        }
      } catch {
        // Worker errors are non-fatal; keep last result
      } finally {
        if (runIdRef.current === id) {
          setIsRunning(false);
          setProgress(100);
        }
      }
    },
    [financialState, baselineScenario],
  );

  // Update scenario and trigger debounced full simulation
  const updateScenario = useCallback(
    (partial: Partial<SimulationScenario>) => {
      setScenario((prev) => {
        const next = mergeScenario(prev, { ...partial, iterations: FULL_ITERATIONS });
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSim(next), DEBOUNCE_MS);
        return next;
      });
    },
    [runSim],
  );

  // Preview mode: immediate run with 50 iterations (for slider drag)
  const previewScenario = useCallback(
    (partial: Partial<SimulationScenario>) => {
      setScenario((prev) => {
        const next = mergeScenario(prev, { ...partial, iterations: PREVIEW_ITERATIONS });
        clearTimeout(debounceRef.current);
        runSim(next);
        return mergeScenario(prev, partial); // Keep iterations at 500 in stored state
      });
    },
    [runSim],
  );

  // Comparison mode
  const setBaseline = useCallback(() => {
    setBaselineScenario({ ...scenario });
  }, [scenario]);

  const clearBaseline = useCallback(() => {
    setBaselineScenario(null);
    setComparison(null);
  }, []);

  // Run initial simulation on mount (intentionally only on mount)
  const runSimRef = useRef(runSim);
  runSimRef.current = runSim;
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  useEffect(() => {
    runSimRef.current(scenarioRef.current);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  return {
    scenario,
    result,
    comparison,
    isRunning,
    progress,
    baselineScenario,
    updateScenario,
    previewScenario,
    setBaseline,
    clearBaseline,
  };
}
