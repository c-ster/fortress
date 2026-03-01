/**
 * Custom hook for the new-child financial planner.
 *
 * Fetches BAH rates asynchronously on mount, then computes the plan
 * synchronously via useMemo whenever inputs change.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FinancialState, NewChildInput, NewChildPlan } from '@fortress/types';
import { calculateNewChildPlan } from '../engine/new-child-calculator';
import { lookupBah } from '../utils/pay-tables';

function buildDefaultInput(state: FinancialState): NewChildInput {
  return {
    expectedMonth: 6,
    currentChildcare: state.expenses.childcare,
    estimatedNewChildcare: 1200,
    estimatedSupplies: 250,
    planFSGLI: true,
    planDepCare: true,
  };
}

export function useNewChild(financialState: FinancialState) {
  const [input, setInput] = useState<NewChildInput>(() =>
    buildDefaultInput(financialState),
  );
  const [bahRates, setBahRates] = useState<{
    withDep: number;
    withoutDep: number;
  } | null>(null);

  // Fetch BAH rates once on mount (and when duty station changes)
  useEffect(() => {
    let cancelled = false;

    async function fetchBah() {
      const [withResult, withoutResult] = await Promise.all([
        lookupBah(financialState.military.dutyStation, true),
        lookupBah(financialState.military.dutyStation, false),
      ]);
      if (!cancelled) {
        setBahRates({
          withDep: withResult?.amount ?? 0,
          withoutDep: withoutResult?.amount ?? 0,
        });
      }
    }

    fetchBah();
    return () => {
      cancelled = true;
    };
  }, [financialState.military.dutyStation]);

  const plan: NewChildPlan | null = useMemo(() => {
    if (!bahRates) return null;
    return calculateNewChildPlan(
      financialState,
      input,
      bahRates.withDep,
      bahRates.withoutDep,
    );
  }, [financialState, input, bahRates]);

  const updateInput = useCallback((partial: Partial<NewChildInput>) => {
    setInput((prev) => ({ ...prev, ...partial }));
  }, []);

  return { input, plan, updateInput, isLoading: !bahRates };
}
