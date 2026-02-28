/**
 * Custom hook for deployment preparation planning.
 *
 * Manages deployment input state and computes the full plan via the engine.
 * All computation is synchronous (no async BAH lookups like PCS).
 */

import { useState, useMemo, useCallback } from 'react';
import type { FinancialState, DeploymentInput, DeploymentPlan } from '@fortress/types';
import { calculateDeploymentPlan } from '../engine/deployment-calculator';

function buildDefaultInput(state: FinancialState): DeploymentInput {
  return {
    deploymentLength: 'medium',
    hasSpouse: state.military.dependents > 0,
    spouseMonthlyIncome: 0,
    reducedExpenses: 0,
  };
}

export function useDeployment(financialState: FinancialState) {
  const [input, setInput] = useState<DeploymentInput>(() =>
    buildDefaultInput(financialState),
  );

  const plan: DeploymentPlan = useMemo(
    () => calculateDeploymentPlan(financialState, input),
    [financialState, input],
  );

  const updateInput = useCallback((partial: Partial<DeploymentInput>) => {
    setInput((prev) => ({ ...prev, ...partial }));
  }, []);

  return { input, plan, updateInput };
}
