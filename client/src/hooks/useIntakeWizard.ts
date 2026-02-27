import { useState, useCallback } from 'react';

export interface StepDefinition {
  label: string;
  shortLabel: string;
  key: string;
}

export const INTAKE_STEPS: StepDefinition[] = [
  { label: 'Military Info', shortLabel: 'Military', key: 'military' },
  { label: 'Income', shortLabel: 'Income', key: 'income' },
  { label: 'Deductions', shortLabel: 'Deductions', key: 'deductions' },
  { label: 'Monthly Expenses', shortLabel: 'Expenses', key: 'expenses' },
  { label: 'Debts', shortLabel: 'Debts', key: 'debts' },
  { label: 'Assets', shortLabel: 'Assets', key: 'assets' },
  { label: 'Review & Save', shortLabel: 'Review', key: 'review' },
];

export function useIntakeWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = INTAKE_STEPS.length;

  const next = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [totalSteps]);

  const back = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goTo = useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setCurrentStep(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [totalSteps],
  );

  return {
    currentStep,
    totalSteps,
    next,
    back,
    goTo,
    isFirst: currentStep === 0,
    isLast: currentStep === totalSteps - 1,
    stepDef: INTAKE_STEPS[currentStep],
    steps: INTAKE_STEPS,
  };
}
