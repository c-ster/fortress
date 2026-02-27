/**
 * Action plan generator — Phase 0 (immediate tier only).
 *
 * Pure function: no side effects, no Zustand, no React.
 * Maps risk findings to concrete, actionable steps with specific mechanisms.
 *
 * Generators:
 *   1. Emergency Fund → savings allotment via myPay
 *   2. High-Interest Debt → SCRA invocation (if eligible) or debt payoff priority
 *   3. SGLI Gap → coverage increase via milConnect/SOES
 *
 * Max 3 actions in the immediate tier. stabilization/compounding reserved for Phase 1.
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

const MAX_IMMEDIATE_ACTIONS = 3;

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

// --- Generator registry ---

const GENERATORS: Partial<Record<RiskCategory, ActionGenerator>> = {
  emergency_fund: generateEmergencyFundAction,
  high_interest_debt: generateHighInterestDebtAction,
  sgli_coverage: generateSgliAction,
};

// --- Public API ---

/**
 * Generate an action plan from the current financial state and risk assessment.
 * Pure function — safe to memoize with useMemo.
 *
 * Phase 0: populates immediate tier only (7-day, easy actions). Max 3 actions.
 * Iterates findings sorted by impact (from risk engine) for priority ordering.
 */
export function generateActionPlan(
  state: FinancialState,
  risk: RiskAssessment,
): ActionPlan {
  const immediate: Action[] = [];

  for (const finding of risk.findings) {
    if (immediate.length >= MAX_IMMEDIATE_ACTIONS) break;

    const generator = GENERATORS[finding.category];
    if (!generator) continue;

    const action = generator(finding, state);
    if (action) {
      immediate.push(action);
    }
  }

  return {
    immediate,
    stabilization: [],
    compounding: [],
  };
}
