/**
 * Action plan generator — 3-tier action plan.
 *
 * Pure function: no side effects, no Zustand, no React.
 * Maps risk findings to concrete, actionable steps with specific mechanisms.
 *
 * Tiers:
 *   Immediate (7-day, easy, max 3):
 *     - Emergency Fund → savings allotment via myPay
 *     - High-Interest Debt → SCRA invocation or debt payoff priority
 *     - SGLI Gap → coverage increase via milConnect/SOES
 *     - TSP Match → increase to 5% on myPay (when gap ≤ 3%)
 *
 *   Stabilization (30-day, medium, max 3):
 *     - TSP Match → gradual increase to 5% (when gap > 3%)
 *     - SCRA Opportunity → formal SCRA letter to lenders
 *     - High-Interest Debt → NMCRS/AFAS debt consolidation
 *     - Debt-to-Income → debt payoff priority plan (DTI 30–50%)
 *
 *   Compounding (90-day, hard, max 3):
 *     - Debt-to-Income → professional financial counseling (DTI > 40%)
 */

import type {
  FinancialState,
  RiskAssessment,
  RiskFinding,
  RiskCategory,
  Action,
  ActionPlan,
} from '@fortress/types';
import { formatCurrencyWhole } from '../utils/format-currency';

// --- Constants ---

/** Disclaimer required on every action plan display. */
export const ACTION_PLAN_DISCLAIMER =
  'Fortress provides financial planning tools, not financial advice. ' +
  'Consult your installation PFC or a licensed financial advisor for personalized guidance.';

const MAX_TIER_ACTIONS = 3;

// --- Types ---

type ActionGenerator = (finding: RiskFinding, state: FinancialState) => Action | null;

// --- Helpers ---

/**
 * Compute "next 1st or 15th" from a given date.
 * Military pay cycles are the 1st and 15th of each month.
 * Exported for testability with injected dates.
 */
export function getNextPayday(from: Date = new Date()): string {
  const day = from.getDate();
  const month = from.getMonth();
  const year = from.getFullYear();

  let target: Date;
  if (day < 15) {
    target = new Date(year, month, 15);
  } else {
    // Next month's 1st
    target = new Date(year, month + 1, 1);
  }

  return target.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Compute a deadline N days from now, formatted as a locale date string.
 * Exported for testability.
 */
export function getDeadlineFromNow(days: number, from: Date = new Date()): string {
  const target = new Date(from.getTime());
  target.setDate(target.getDate() + days);
  return target.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Immediate Generators (7-day, easy) ---

// --- Generator 1: Emergency Fund → Savings Allotment ---

function generateEmergencyFundAction(
  finding: RiskFinding,
  state: FinancialState,
): Action | null {
  const { totalEssential } = state.expenses;
  const { totalLiquid } = state.assets;
  const { totalGross } = state.income;

  // Can't compute meaningful allotment without income/expense data
  if (totalEssential === 0 || totalGross === 0) return null;

  const gap = 3 * totalEssential - totalLiquid;
  if (gap <= 0) return null;

  // Spread gap over 6 months, round up to nearest $50
  const gapSixth = Math.ceil(gap / 6 / 50) * 50;
  // Cap at 10% of gross income, rounded to nearest $50
  const tenPercentGross = Math.round((totalGross * 0.1) / 50) * 50;
  // Floor at $50 to ensure meaningful action
  const allotmentAmount = Math.max(50, Math.min(gapSixth, tenPercentGross));

  const deadline = getNextPayday();
  const monthsToGoal = Math.ceil(gap / allotmentAmount);

  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + monthsToGoal);
  const targetMonth = futureDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return {
    id: `action_emergency_fund_${finding.id}`,
    riskFindingId: finding.id,
    title: 'Set up savings allotment on myPay',
    description:
      `Set up an automatic ${formatCurrencyWhole(allotmentAmount)}/month allotment ` +
      `from your military pay to a savings account. This builds your emergency fund ` +
      `automatically with no monthly effort required.`,
    mechanism: 'myPay > Allotments > Add New > Savings',
    amount: allotmentAmount,
    deadline: `Before ${deadline}`,
    estimatedImpact:
      `Builds ${formatCurrencyWhole(allotmentAmount * 6)} in emergency savings by ${targetMonth}`,
    difficulty: 'easy',
    estimatedMinutes: 10,
    status: 'pending',
  };
}

// --- Generator 2: High-Interest Debt → SCRA or Payoff ---

function generateHighInterestDebtAction(
  finding: RiskFinding,
  state: FinancialState,
): Action | null {
  const highInterestDebts = state.debts.filter((d) => d.apr > 15);
  if (highInterestDebts.length === 0) return null;

  const deadline = getNextPayday();

  // Branch: SCRA-eligible → invoke SCRA rate cap
  if (state.military.scraEligible) {
    const scraDebts = state.debts.filter((d) => d.preService && d.apr > 6);
    const totalScraSavings = state.risk.scraOpportunity;

    return {
      id: `action_scra_invocation_${finding.id}`,
      riskFindingId: finding.id,
      title: 'Invoke SCRA interest rate cap on pre-service debts',
      description:
        `You have ${scraDebts.length} pre-service debt${scraDebts.length !== 1 ? 's' : ''} ` +
        `eligible for SCRA protection. The Servicemembers Civil Relief Act caps interest ` +
        `at 6% on debts incurred before active duty. Contact each lender with your ` +
        `active-duty orders to invoke this protection.`,
      mechanism:
        'Contact lender > Request SCRA rate reduction > ' +
        'Provide copy of active-duty orders > Follow up in writing',
      amount: Math.round(totalScraSavings * 12),
      deadline: `Before ${deadline}`,
      estimatedImpact:
        `Saves approximately ${formatCurrencyWhole(totalScraSavings)}/month ` +
        `(${formatCurrencyWhole(totalScraSavings * 12)}/year) in interest charges`,
      difficulty: 'easy',
      estimatedMinutes: 30,
      status: 'pending',
    };
  }

  // Non-SCRA path: prioritize highest-APR debt
  const sorted = [...highInterestDebts].sort((a, b) => b.apr - a.apr);
  const worst = sorted[0];
  const monthlyInterest = Math.round((worst.balance * worst.apr) / 100 / 12);

  return {
    id: `action_debt_payoff_${finding.id}`,
    riskFindingId: finding.id,
    title: `Prioritize paying off ${worst.name}`,
    description:
      `Your ${worst.name} has a ${worst.apr}% APR with a ` +
      `${formatCurrencyWhole(worst.balance)} balance. Focus extra payments here first ` +
      `to reduce the highest-cost debt. Even ${formatCurrencyWhole(50)} extra per month ` +
      `above the minimum accelerates payoff significantly.`,
    mechanism:
      'Review budget for extra payment capacity > ' +
      'Set up additional payment to highest-APR debt > ' +
      'Consider balance transfer to lower-rate card',
    amount: worst.balance,
    deadline: `Before ${deadline}`,
    estimatedImpact:
      `Eliminating this debt saves approximately ` +
      `${formatCurrencyWhole(monthlyInterest)}/month in interest`,
    difficulty: 'easy',
    estimatedMinutes: 15,
    status: 'pending',
  };
}

// --- Generator 3: SGLI Gap → Coverage Increase ---

function generateSgliAction(
  finding: RiskFinding,
  state: FinancialState,
): Action | null {
  const currentCoverage = state.deductions.sgliCoverage;
  const gap = 500_000 - currentCoverage;
  if (gap <= 0) return null;

  const monthlyCost = Math.round((gap / 100_000) * 6);
  const deps = state.military.dependents;
  const deadline = getNextPayday();

  return {
    id: `action_sgli_increase_${finding.id}`,
    riskFindingId: finding.id,
    title: 'Increase SGLI coverage to $500,000',
    description:
      `You currently have ${formatCurrencyWhole(currentCoverage)} in SGLI coverage ` +
      `with ${deps} dependent${deps !== 1 ? 's' : ''}. ` +
      `The maximum $500,000 coverage is strongly recommended for service members ` +
      `with dependents. The increase costs approximately $${monthlyCost}/month.`,
    mechanism:
      'milConnect > SGLI Online Enrollment System (SOES) > ' +
      'Update coverage amount > Select $500,000',
    amount: undefined,
    deadline: `Before ${deadline}`,
    estimatedImpact:
      `Provides ${formatCurrencyWhole(500_000)} in life insurance protection ` +
      `for your family at $${monthlyCost}/month`,
    difficulty: 'easy',
    estimatedMinutes: 15,
    status: 'pending',
  };
}

// --- Generator 4: TSP Match → Immediate (small gap ≤ 3%) ---

function generateTspImmediateAction(
  finding: RiskFinding,
  state: FinancialState,
): Action | null {
  if (state.military.retirementSystem !== 'brs') return null;
  const { basePay } = state.income;
  if (basePay === 0) return null;

  const pct = state.deductions.tspContributionPct;
  const gap = 0.05 - pct;

  // Only immediate tier when gap ≤ 3% (i.e. already at 2%+)
  if (gap > 0.03 || gap <= 0) return null;

  const monthlyIncrease = Math.round(basePay * gap);
  const annualMatch = Math.round(basePay * 12 * gap);
  const compounded20yr = Math.round(annualMatch * ((Math.pow(1.07, 20) - 1) / 0.07));
  const deadline = getNextPayday();

  return {
    id: `action_tsp_immediate_${finding.id}`,
    riskFindingId: finding.id,
    title: 'Increase TSP contribution to 5% on myPay',
    description:
      `You're contributing ${(pct * 100).toFixed(1)}% to TSP. Increase to 5% to capture ` +
      `the full BRS government match. This adds ${formatCurrencyWhole(monthlyIncrease)}/month ` +
      'to your retirement savings.',
    mechanism: 'myPay > TSP Contributions > Traditional/Roth > Set to 5%',
    amount: monthlyIncrease,
    deadline: `Before ${deadline}`,
    estimatedImpact:
      `Captures ${formatCurrencyWhole(annualMatch)}/year in government match, ` +
      `potentially growing to ${formatCurrencyWhole(compounded20yr)} over 20 years at 7% growth`,
    difficulty: 'easy',
    estimatedMinutes: 10,
    status: 'pending',
  };
}

// --- Stabilization Generators (30-day, medium) ---

// --- Generator 5: TSP Match → Stabilization (large gap > 3%) ---

function generateTspStabilizationAction(
  finding: RiskFinding,
  state: FinancialState,
): Action | null {
  if (state.military.retirementSystem !== 'brs') return null;
  const { basePay } = state.income;
  if (basePay === 0) return null;

  const pct = state.deductions.tspContributionPct;
  const gap = 0.05 - pct;

  // Only stabilization tier when gap > 3% (i.e. below 2%)
  if (gap <= 0.03) return null;

  const annualMatch = Math.round(basePay * 12 * 0.05);
  const compounded20yr = Math.round(annualMatch * ((Math.pow(1.07, 20) - 1) / 0.07));
  const deadline = getDeadlineFromNow(30);

  return {
    id: `action_tsp_stabilization_${finding.id}`,
    riskFindingId: finding.id,
    title: 'Gradually increase TSP contribution to 5%',
    description:
      `You're contributing ${(pct * 100).toFixed(1)}% to TSP. Increase by 1% each month ` +
      'until reaching 5% to capture the full BRS government match without a sudden budget impact.',
    mechanism:
      'myPay > TSP Contributions > Increase by 1% each month until reaching 5%',
    amount: Math.round(basePay * gap),
    deadline: `Before ${deadline}`,
    estimatedImpact:
      `Full 5% match captures up to ${formatCurrencyWhole(annualMatch)}/year, ` +
      `potentially growing to ${formatCurrencyWhole(compounded20yr)} over 20 years at 7% growth`,
    difficulty: 'medium',
    estimatedMinutes: 15,
    status: 'pending',
  };
}

// --- Generator 6: SCRA Opportunity → Formal SCRA Letter ---

function generateScraStabilizationAction(
  finding: RiskFinding,
  state: FinancialState,
): Action | null {
  const monthlySavings = state.risk.scraOpportunity;
  if (monthlySavings === 0) return null;

  const scraDebts = state.debts.filter((d) => d.preService && d.apr > 6);
  if (scraDebts.length === 0) return null;

  const annualSavings = Math.round(monthlySavings * 12);
  const deadline = getDeadlineFromNow(30);

  return {
    id: `action_scra_formal_${finding.id}`,
    riskFindingId: finding.id,
    title: 'Request SCRA rate reduction from lenders',
    description:
      `You have ${scraDebts.length} pre-service debt${scraDebts.length !== 1 ? 's' : ''} ` +
      'eligible for SCRA protection. Send formal requests with active-duty orders to each ' +
      'lender via certified mail and follow up after 30 days.',
    mechanism:
      'Gather active-duty orders > Draft SCRA request letter > ' +
      'Send to each lender via certified mail > Follow up after 30 days',
    amount: annualSavings,
    deadline: `Before ${deadline}`,
    estimatedImpact:
      `Saves ${formatCurrencyWhole(monthlySavings)}/month ` +
      `(${formatCurrencyWhole(annualSavings)}/year) in interest charges`,
    difficulty: 'medium',
    estimatedMinutes: 45,
    status: 'pending',
  };
}

// --- Generator 7: High-Interest Debt → Consolidation Assistance ---

function generateDebtConsolidationAction(
  finding: RiskFinding,
  _state: FinancialState,
): Action | null {
  const deadline = getDeadlineFromNow(30);

  return {
    id: `action_debt_consolidation_${finding.id}`,
    riskFindingId: finding.id,
    title: 'Contact NMCRS/AFAS for debt consolidation assistance',
    description:
      'Military relief societies offer interest-free loans and debt management programs. ' +
      'Contact Navy-Marine Corps Relief Society (NMCRS), Air Force Aid Society (AFAS), ' +
      'or Army Emergency Relief (AER) based on your branch.',
    mechanism:
      'Military OneSource > Financial Assistance > NMCRS (Navy/Marines) or ' +
      'AFAS (Air Force/Space Force) or AER (Army) > Apply for debt management plan',
    amount: undefined,
    deadline: `Before ${deadline}`,
    estimatedImpact:
      'Interest-free consolidation loan can significantly reduce monthly debt payments ' +
      'and accelerate payoff timeline',
    difficulty: 'medium',
    estimatedMinutes: 30,
    status: 'pending',
  };
}

// --- Generator 8: DTI → Debt Payoff Strategy (30–50%) ---

function generateDtiStabilizationAction(
  finding: RiskFinding,
  state: FinancialState,
): Action | null {
  const dti = state.risk.debtToIncomeRatio;
  const gross = state.income.totalGross;

  // Only stabilization tier for DTI 30–50%
  if (dti <= 0.30 || gross === 0) return null;

  const monthlyDebt = Math.round(dti * gross);
  const deadline = getDeadlineFromNow(30);

  return {
    id: `action_dti_strategy_${finding.id}`,
    riskFindingId: finding.id,
    title: 'Create debt payoff priority plan',
    description:
      `Your debt-to-income ratio is ${(dti * 100).toFixed(0)}%. ` +
      'Use the avalanche method (highest APR first) or snowball method ' +
      '(smallest balance first) to systematically reduce debt payments.',
    mechanism:
      'List all debts by APR > Allocate extra payment to highest-APR debt > ' +
      'Set up automatic payments > Review monthly',
    amount: monthlyDebt,
    deadline: `Before ${deadline}`,
    estimatedImpact:
      `Reducing DTI below 30% frees up ${formatCurrencyWhole(monthlyDebt - Math.round(gross * 0.30))}/month ` +
      'and strengthens security clearance posture',
    difficulty: 'medium',
    estimatedMinutes: 30,
    status: 'pending',
  };
}

// --- Compounding Generators (90-day, hard) ---

// --- Generator 9: DTI → Professional Counseling (> 40%) ---

function generateDtiCompoundingAction(
  finding: RiskFinding,
  state: FinancialState,
): Action | null {
  const dti = state.risk.debtToIncomeRatio;

  // Only compounding tier for DTI > 40%
  if (dti <= 0.40) return null;

  const deadline = getDeadlineFromNow(90);

  return {
    id: `action_dti_counseling_${finding.id}`,
    riskFindingId: finding.id,
    title: 'Schedule appointment with installation PFC',
    description:
      `Your debt-to-income ratio of ${(dti * 100).toFixed(0)}% indicates a need for professional ` +
      'financial counseling. Personal Financial Counselors (PFCs) at your installation provide ' +
      'free, confidential debt management assistance. This also proactively protects your security clearance.',
    mechanism:
      'Military OneSource (800-342-9647) > Request PFC referral > ' +
      'Schedule appointment > Bring full debt documentation',
    amount: undefined,
    deadline: `Before ${deadline}`,
    estimatedImpact:
      'Professional debt management plan can reduce DTI by 10–15% within 12 months ' +
      'and demonstrates proactive financial responsibility for clearance reviews',
    difficulty: 'hard',
    estimatedMinutes: 60,
    status: 'pending',
  };
}

// --- Generator registries ---

const IMMEDIATE_GENERATORS: Partial<Record<RiskCategory, ActionGenerator>> = {
  emergency_fund: generateEmergencyFundAction,
  high_interest_debt: generateHighInterestDebtAction,
  sgli_coverage: generateSgliAction,
  tsp_match: generateTspImmediateAction,
};

const STABILIZATION_GENERATORS: Partial<Record<RiskCategory, ActionGenerator>> = {
  tsp_match: generateTspStabilizationAction,
  scra_opportunity: generateScraStabilizationAction,
  high_interest_debt: generateDebtConsolidationAction,
  debt_to_income: generateDtiStabilizationAction,
};

const COMPOUNDING_GENERATORS: Partial<Record<RiskCategory, ActionGenerator>> = {
  debt_to_income: generateDtiCompoundingAction,
};

// --- Collection helper ---

/**
 * Collect up to `max` actions from a tier's generators, iterating findings
 * in priority order (most impactful first, as sorted by the risk engine).
 */
function collectTierActions(
  findings: RiskFinding[],
  state: FinancialState,
  generators: Partial<Record<RiskCategory, ActionGenerator>>,
  max: number,
): Action[] {
  const actions: Action[] = [];
  for (const finding of findings) {
    if (actions.length >= max) break;
    const generator = generators[finding.category];
    if (!generator) continue;
    const action = generator(finding, state);
    if (action) actions.push(action);
  }
  return actions;
}

// --- Public API ---

/**
 * Generate an action plan from the current financial state and risk assessment.
 * Pure function — safe to memoize with useMemo.
 *
 * Populates all 3 tiers (immediate/stabilization/compounding), max 3 actions each.
 * Iterates findings sorted by impact (from risk engine) for priority ordering.
 */
export function generateActionPlan(
  state: FinancialState,
  risk: RiskAssessment,
): ActionPlan {
  return {
    immediate: collectTierActions(risk.findings, state, IMMEDIATE_GENERATORS, MAX_TIER_ACTIONS),
    stabilization: collectTierActions(risk.findings, state, STABILIZATION_GENERATORS, MAX_TIER_ACTIONS),
    compounding: collectTierActions(risk.findings, state, COMPOUNDING_GENERATORS, MAX_TIER_ACTIONS),
  };
}
