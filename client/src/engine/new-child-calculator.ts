/**
 * New-child financial impact calculator.
 *
 * Pure functions — no React, no side effects.
 * BAH values are passed in (pre-fetched by the hook) to keep everything synchronous.
 */

import type {
  FinancialState,
  NewChildInput,
  NewChildPlan,
  BahImpact,
  MonthlyBudgetImpact,
  EmergencyFundCheck,
  TaxBenefits,
  NewChildAction,
} from '@fortress/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Annual child tax credit per qualifying child. */
export const CHILD_TAX_CREDIT = 2_000;

/** Annual Dependent Care FSA contribution cap (married filing jointly). */
export const DEP_CARE_FSA_MAX = 5_000;

/** Estimated monthly FSGLI spouse premium. */
export const FSGLI_SPOUSE_COST = 10;

/** Rough marginal tax rate for FSA savings estimate. */
export const ROUGH_TAX_RATE = 0.22;

/** Emergency fund target: months of expenses. */
export const EMERGENCY_FUND_MONTHS = 3;

// ---------------------------------------------------------------------------
// Sub-calculators
// ---------------------------------------------------------------------------

/**
 * Determine BAH impact of adding a dependent.
 * BAH is binary: "with dependents" vs "without dependents".
 * Only the first dependent (0→1) triggers a rate change.
 */
export function calculateBahImpact(
  state: FinancialState,
  bahWithDep: number,
  bahWithoutDep: number,
): BahImpact {
  const currentDependents = state.military.dependents;
  const firstChild = currentDependents === 0;

  // If service member already has dependents, BAH stays the same
  const currentRate = currentDependents > 0 ? bahWithDep : bahWithoutDep;
  const newRate = bahWithDep; // after new child, always "with dependents"
  const monthlyDelta = firstChild ? newRate - currentRate : 0;

  return { currentRate, newRate, monthlyDelta, firstChild };
}

/**
 * Calculate net monthly budget impact of the new child.
 */
export function calculateBudgetImpact(
  state: FinancialState,
  input: NewChildInput,
  bahImpact: BahImpact,
): MonthlyBudgetImpact {
  const additionalChildcare = input.estimatedNewChildcare;
  const suppliesCost = input.estimatedSupplies;
  const fsgliFee = input.planFSGLI ? FSGLI_SPOUSE_COST : 0;

  // Dependent Care FSA saves taxes on childcare expenses
  const totalChildcare = input.currentChildcare + additionalChildcare;
  const annualChildcare = totalChildcare * 12;
  const fsaAmount = input.planDepCare ? Math.min(annualChildcare, DEP_CARE_FSA_MAX) : 0;
  const depCareSavings = Math.round((fsaAmount * ROUGH_TAX_RATE) / 12);

  const totalNewExpenses = additionalChildcare + suppliesCost + fsgliFee;
  const bahIncrease = bahImpact.monthlyDelta;
  const netMonthlyDelta = bahIncrease + depCareSavings - totalNewExpenses;

  return {
    additionalChildcare,
    suppliesCost,
    fsgliFee,
    depCareSavings,
    totalNewExpenses,
    bahIncrease,
    netMonthlyDelta,
  };
}

/**
 * Check emergency fund adequacy after adding new-child expenses.
 */
export function calculateEmergencyFund(
  state: FinancialState,
  input: NewChildInput,
  budgetImpact: MonthlyBudgetImpact,
): EmergencyFundCheck {
  const currentFund = state.assets.emergencyFund;
  const monthlyExpensesAfter = state.expenses.totalMonthly + budgetImpact.totalNewExpenses;
  const recommended = monthlyExpensesAfter * EMERGENCY_FUND_MONTHS;
  const monthsCovered = monthlyExpensesAfter > 0
    ? currentFund / monthlyExpensesAfter
    : 0;
  const gap = Math.max(0, recommended - currentFund);

  return { currentFund, monthlyExpensesAfter, monthsCovered, recommended, gap };
}

/**
 * Estimate annual tax benefits from adding a child.
 */
export function calculateTaxBenefits(
  state: FinancialState,
  input: NewChildInput,
): TaxBenefits {
  const childTaxCredit = CHILD_TAX_CREDIT;

  const totalChildcare = (input.currentChildcare + input.estimatedNewChildcare) * 12;
  const fsaAmount = input.planDepCare ? Math.min(totalChildcare, DEP_CARE_FSA_MAX) : 0;
  const depCareFSA = Math.round(fsaAmount * ROUGH_TAX_RATE);

  const estimatedAnnualSavings = childTaxCredit + depCareFSA;

  return { childTaxCredit, depCareFSA, estimatedAnnualSavings };
}

/**
 * Build the new-child action checklist.
 * Items are grouped by timeframe: before_birth, within_30_days, within_90_days.
 */
export function buildNewChildActions(
  state: FinancialState,
  input: NewChildInput,
): NewChildAction[] {
  const actions: NewChildAction[] = [];
  const firstChild = state.military.dependents === 0;

  // --- Before Birth ---

  actions.push({
    id: 'update-w4',
    title: 'Update W-4 Tax Withholding',
    description: 'Adjust federal tax withholding to account for the new dependent.',
    mechanism: 'Submit updated W-4 through myPay to reduce withholding and increase take-home pay.',
    category: 'financial',
    timeframe: 'before_birth',
  });

  actions.push({
    id: 'review-will',
    title: 'Review/Update Will & POA',
    description: 'Ensure your will and power of attorney include provisions for the new child.',
    mechanism: 'Visit the base legal assistance office (JAG) for free will preparation or update.',
    category: 'legal',
    timeframe: 'before_birth',
  });

  actions.push({
    id: 'budget-adjustment',
    title: 'Adjust Monthly Budget',
    description: 'Plan for increased expenses: childcare, diapers, formula, clothing, and medical copays.',
    mechanism: 'Review current spending and identify areas to reduce; set up allotment for baby expenses.',
    category: 'financial',
    timeframe: 'before_birth',
  });

  actions.push({
    id: 'emergency-fund',
    title: 'Build Emergency Fund Buffer',
    description: 'Increase emergency fund to cover 3 months of higher expenses.',
    mechanism: 'Set up automatic allotment to savings account before the baby arrives.',
    category: 'financial',
    timeframe: 'before_birth',
  });

  if (input.planDepCare) {
    actions.push({
      id: 'dep-care-fsa',
      title: 'Enroll in Dependent Care FSA',
      description: 'Set up a Dependent Care FSA to save on childcare taxes.',
      mechanism: 'Enroll during open season or within 60 days of qualifying life event (birth).',
      category: 'financial',
      timeframe: 'before_birth',
    });
  }

  // --- Within 30 Days ---

  actions.push({
    id: 'deers-enrollment',
    title: 'Enroll Child in DEERS',
    description: 'Register the new child in the Defense Enrollment Eligibility Reporting System.',
    mechanism: 'Visit the nearest ID card office with birth certificate and your military ID.',
    category: 'admin',
    timeframe: 'within_30_days',
  });

  actions.push({
    id: 'tricare-enrollment',
    title: 'Enroll Child in TRICARE',
    description: 'Add child to TRICARE health coverage for medical, dental, and vision.',
    mechanism: 'After DEERS enrollment, register at the MTF or call TRICARE for civilian provider network.',
    category: 'insurance',
    timeframe: 'within_30_days',
  });

  if (firstChild) {
    actions.push({
      id: 'bah-update',
      title: 'Apply for BAH With Dependents',
      description: 'Your BAH rate will increase as you transition from "without" to "with dependents".',
      mechanism: 'Submit BAH change request through your unit admin/finance office after DEERS enrollment.',
      category: 'admin',
      timeframe: 'within_30_days',
    });
  }

  if (input.planFSGLI) {
    actions.push({
      id: 'fsgli-update',
      title: 'Enroll/Update FSGLI Coverage',
      description: 'Add or update Family SGLI coverage for your spouse and new child.',
      mechanism: 'Complete SGLV 8286A form; child coverage is automatic but verify through your unit.',
      category: 'insurance',
      timeframe: 'within_30_days',
    });
  }

  // --- Within 90 Days ---

  actions.push({
    id: 'sgli-beneficiary',
    title: 'Update SGLI Beneficiaries',
    description: 'Review and update SGLI beneficiary designations to include the new child.',
    mechanism: 'Update SGLV 8286 form through your unit personnel office or milConnect.',
    category: 'insurance',
    timeframe: 'within_90_days',
  });

  actions.push({
    id: 'childcare-plan',
    title: 'Secure Childcare Arrangements',
    description: 'Apply for on-base CDC or research off-base childcare options.',
    mechanism: 'Apply at militarychildcare.com; waitlists can be long so apply early.',
    category: 'admin',
    timeframe: 'within_90_days',
  });

  actions.push({
    id: 'review-insurance',
    title: 'Review Life Insurance Adequacy',
    description: 'Ensure SGLI coverage is sufficient for a larger family.',
    mechanism: 'Current SGLI max is $500K; consider supplemental coverage if needed.',
    category: 'insurance',
    timeframe: 'within_90_days',
  });

  return actions;
}

/**
 * Build a recommendation summary.
 */
export function buildRecommendation(
  budgetImpact: MonthlyBudgetImpact,
  emergencyFund: EmergencyFundCheck,
  bahImpact: BahImpact,
): string {
  const parts: string[] = [];

  if (bahImpact.firstChild) {
    parts.push(
      `Your BAH will increase by $${bahImpact.monthlyDelta.toLocaleString()}/mo as a first-time dependent sponsor.`,
    );
  } else {
    parts.push('Your BAH rate will not change since you already receive the "with dependents" rate.');
  }

  if (budgetImpact.netMonthlyDelta >= 0) {
    parts.push(
      `The combined BAH increase and tax savings fully offset estimated new expenses — net positive $${budgetImpact.netMonthlyDelta.toLocaleString()}/mo.`,
    );
  } else {
    const shortfall = Math.abs(budgetImpact.netMonthlyDelta);
    parts.push(
      `Estimated new expenses exceed income increases by $${shortfall.toLocaleString()}/mo. Review your budget for areas to adjust.`,
    );
  }

  if (emergencyFund.gap > 0) {
    parts.push(
      `Your emergency fund is short by $${emergencyFund.gap.toLocaleString()} to cover 3 months of post-child expenses. Prioritize building this buffer before the baby arrives.`,
    );
  } else {
    parts.push('Your emergency fund meets the recommended 3-month buffer for your new expense level.');
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Calculate the complete new-child financial plan.
 *
 * @param state      Current financial state from the store
 * @param input      User inputs for the new-child scenario
 * @param bahWithDep BAH rate for "with dependents" (pre-fetched)
 * @param bahWithoutDep BAH rate for "without dependents" (pre-fetched)
 */
export function calculateNewChildPlan(
  state: FinancialState,
  input: NewChildInput,
  bahWithDep: number,
  bahWithoutDep: number,
): NewChildPlan {
  const bahImpact = calculateBahImpact(state, bahWithDep, bahWithoutDep);
  const budgetImpact = calculateBudgetImpact(state, input, bahImpact);
  const emergencyFund = calculateEmergencyFund(state, input, budgetImpact);
  const taxBenefits = calculateTaxBenefits(state, input);
  const actions = buildNewChildActions(state, input);
  const recommendation = buildRecommendation(budgetImpact, emergencyFund, bahImpact);

  return { bahImpact, budgetImpact, emergencyFund, taxBenefits, actions, recommendation };
}
