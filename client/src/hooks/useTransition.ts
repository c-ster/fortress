/**
 * Custom hook for military-to-civilian transition planning.
 *
 * Manages transition input state and computes the full plan via the engine.
 * All computation is synchronous — no async operations needed.
 */

import { useState, useMemo, useCallback } from 'react';
import type { FinancialState, TransitionInput, TransitionPlan } from '@fortress/types';
import { calculateTransitionPlan } from '../engine/transition-calculator';

function buildDefaultInput(state: FinancialState): TransitionInput {
  const isRetirementEligible = state.military.yearsOfService >= 20;
  return {
    separationType: isRetirementEligible ? 'retirement' : 'ets',
    monthsUntilSeparation: 12,
    expectedCivilianIncome: 0,
    civilianHealthInsuranceCost: 500,
    tspAction: 'leave',
    tspWithdrawalPct: 0,
    brsLumpSumPct: 0,
    vaDisabilityRating: 0,
  };
}

export function useTransition(financialState: FinancialState) {
  const [input, setInput] = useState<TransitionInput>(() =>
    buildDefaultInput(financialState),
  );

  const plan: TransitionPlan = useMemo(
    () => calculateTransitionPlan(financialState, input),
    [financialState, input],
  );

  const updateInput = useCallback((partial: Partial<TransitionInput>) => {
    setInput((prev) => ({ ...prev, ...partial }));
  }, []);

  return { input, plan, updateInput };
}
