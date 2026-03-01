/**
 * Transition playbook types.
 * Models military-to-civilian transition planning: separation type,
 * retirement pay, income comparison, benefits transition, and checklists.
 */

// ────────────────────────────────────────────────────────────
// Inputs
// ────────────────────────────────────────────────────────────

export type SeparationType = 'ets' | 'retirement' | 'medical';
export type TspAction = 'leave' | 'rollover_ira' | 'partial_withdrawal';

export interface TransitionInput {
  separationType: SeparationType;
  monthsUntilSeparation: number;        // 1–60
  expectedCivilianIncome: number;       // monthly gross
  civilianHealthInsuranceCost: number;  // monthly
  tspAction: TspAction;
  tspWithdrawalPct: number;             // 0–100, only if partial_withdrawal
  brsLumpSumPct: number;                // 0 | 25 | 50 (BRS retirees only)
  vaDisabilityRating: number;           // 0–100 in steps of 10
}

// ────────────────────────────────────────────────────────────
// Retirement Pay
// ────────────────────────────────────────────────────────────

export interface RetirementPayEstimate {
  eligible: boolean;
  system: 'brs' | 'legacy' | 'unknown';
  highThreeBase: number;
  multiplier: number;
  annualRetirementPay: number;
  monthlyRetirementPay: number;
  brsLumpSum: number;
  reducedMonthlyIfLumpSum: number;
}

// ────────────────────────────────────────────────────────────
// Income Comparison
// ────────────────────────────────────────────────────────────

export interface IncomeComparison {
  currentMilitaryGross: number;
  currentMilitaryNet: number;
  projectedCivilianGross: number;
  projectedCivilianNet: number;
  retirementIncome: number;
  vaDisabilityIncome: number;
  totalPostServiceIncome: number;
  monthlyDelta: number;
}

// ────────────────────────────────────────────────────────────
// Benefits Transition
// ────────────────────────────────────────────────────────────

export interface BenefitsTransition {
  tricareCost: number;
  civilianHealthCost: number;
  healthCostDelta: number;
  sgliCoverage: number;
  vgliEstimatedCost: number;
  giEligible: boolean;
}

// ────────────────────────────────────────────────────────────
// Checklist
// ────────────────────────────────────────────────────────────

export type ChecklistPhase = '12_months' | '6_months' | '90_days' | '30_days';
export type ChecklistCategory = 'financial' | 'benefits' | 'career' | 'legal';

export interface TransitionChecklistItem {
  id: string;
  title: string;
  description: string;
  mechanism: string;
  category: ChecklistCategory;
}

export interface TransitionChecklist {
  phase: ChecklistPhase;
  label: string;
  items: TransitionChecklistItem[];
}

// ────────────────────────────────────────────────────────────
// TSP Summary
// ────────────────────────────────────────────────────────────

export interface TspSummary {
  action: string;
  taxImplication: string;
  balance: number;
}

// ────────────────────────────────────────────────────────────
// Emergency Fund Adequacy
// ────────────────────────────────────────────────────────────

export interface EmergencyFundAdequacy {
  months: number;
  recommended: number;
  gap: number;
}

// ────────────────────────────────────────────────────────────
// Full Plan
// ────────────────────────────────────────────────────────────

export interface TransitionPlan {
  retirementPay: RetirementPayEstimate;
  incomeComparison: IncomeComparison;
  benefits: BenefitsTransition;
  tspSummary: TspSummary;
  emergencyFundAdequacy: EmergencyFundAdequacy;
  checklists: TransitionChecklist[];
  recommendation: string;
}
