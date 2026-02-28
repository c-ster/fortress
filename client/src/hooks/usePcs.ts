/**
 * Custom hook for PCS (Permanent Change of Station) cost planning.
 *
 * Manages move input state, performs async BAH lookups for both stations,
 * and calculates the full cost breakdown via the PCS engine.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { FinancialState, PcsInput, PcsCostBreakdown } from '@fortress/types';
import { calculatePcsCosts } from '../engine/pcs-calculator';
import { lookupBah } from '../utils/pay-tables';

const DEBOUNCE_MS = 300;

function buildDefaultInput(state: FinancialState): PcsInput {
  return {
    currentZip: '',
    newZip: '',
    payGrade: state.military.payGrade,
    dependents: state.military.dependents,
    moveDate: '',
    distanceMiles: 0,
    estimatedWeight: 0,
    moveType: 'tmo',
    storageMonths: 0,
    tleDays: 5,
  };
}

export function usePcs(financialState: FinancialState) {
  const [input, setInput] = useState<PcsInput>(() => buildDefaultInput(financialState));
  const [result, setResult] = useState<PcsCostBreakdown | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [currentStation, setCurrentStation] = useState<string | null>(null);
  const [newStation, setNewStation] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const calcIdRef = useRef(0);

  // Recalculate when inputs have both ZIPs and distance
  const recalculate = useCallback(async (pcsInput: PcsInput) => {
    const hasMinData =
      pcsInput.currentZip.length >= 5 &&
      pcsInput.newZip.length >= 5 &&
      pcsInput.distanceMiles > 0;

    if (!hasMinData) {
      setResult(null);
      return;
    }

    const id = ++calcIdRef.current;
    setIsCalculating(true);

    try {
      const [currentBahResult, newBahResult] = await Promise.all([
        lookupBah(pcsInput.currentZip, pcsInput.dependents > 0),
        lookupBah(pcsInput.newZip, pcsInput.dependents > 0),
      ]);

      if (calcIdRef.current !== id) return; // stale

      setCurrentStation(currentBahResult?.installation ?? null);
      setNewStation(newBahResult?.installation ?? null);

      const breakdown = calculatePcsCosts(
        pcsInput,
        currentBahResult?.amount ?? 0,
        newBahResult?.amount ?? 0,
      );

      if (calcIdRef.current !== id) return; // stale
      setResult(breakdown);
    } finally {
      if (calcIdRef.current === id) setIsCalculating(false);
    }
  }, []);

  const updateInput = useCallback(
    (partial: Partial<PcsInput>) => {
      setInput((prev) => {
        const next = { ...prev, ...partial };
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => recalculate(next), DEBOUNCE_MS);
        return next;
      });
    },
    [recalculate],
  );

  // Sync payGrade/dependents if FSM changes
  useEffect(() => {
    setInput((prev) => ({
      ...prev,
      payGrade: financialState.military.payGrade,
      dependents: financialState.military.dependents,
    }));
  }, [financialState.military.payGrade, financialState.military.dependents]);

  return {
    input,
    result,
    isCalculating,
    currentStation,
    newStation,
    updateInput,
  };
}
