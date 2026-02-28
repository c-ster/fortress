/**
 * Deployment preparation calculator — pure functions.
 *
 * Estimates budget impact during military deployment, audits recurring bills
 * for auto-pay setup, generates preparation actions, and builds a spousal
 * handover summary.
 *
 * No React, no side effects. OPSEC: no specific dates/locations in output.
 *
 * README §6.6: "Deployment Module: Spousal income buffer, auto-bill audit."
 */

import type {
  FinancialState,
  DeploymentInput,
  DeploymentBudgetImpact,
  BillAuditItem,
  DeploymentAction,
  DeploymentPlan,
  DeploymentLength,
} from '@fortress/types';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

/** Deployment length in months by category. */
export const DEPLOYMENT_MONTHS: Record<DeploymentLength, number> = {
  short: 3,
  medium: 6,
  long: 12,
};

/** Imminent Danger Pay (IDP) — $225/mo for deployed zones. */
export const IMMINENT_DANGER_PAY = 225;

/** Hardship Duty Pay — average $150/mo for deployed locations. */
export const HARDSHIP_DUTY_PAY = 150;

/** Family Separation Allowance — $250/mo when separated from dependents >30 days. */
export const FAMILY_SEPARATION_ALLOWANCE = 250;

/** Recommended emergency buffer in months of essential expenses. */
export const RECOMMENDED_BUFFER_MONTHS = 4;

/** Combat Zone Tax Exclusion: enlisted pay is fully tax-exempt. */
const ENLISTED_TAX_SAVINGS_FACTOR = 0.15;

/** Max deployment actions to generate. */
const MAX_ACTIONS = 8;

// ────────────────────────────────────────────────────────────
// Budget Impact
// ────────────────────────────────────────────────────────────

/**
 * Calculate monthly budget impact during deployment.
 *
 * During deployment, the SM typically gains:
 * - Imminent Danger Pay ($225/mo)
 * - Hardship Duty Pay (~$150/mo)
 * - Family Separation Allowance ($250/mo if dependents)
 * - Combat Zone Tax Exclusion (enlisted: ~15% base pay savings)
 *
 * And loses/changes:
 * - Some expenses reduce (food, transportation, discretionary)
 * - Spouse income may change
 */
export function calculateBudgetImpact(
  state: FinancialState,
  input: DeploymentInput,
): DeploymentBudgetImpact {
  const months = DEPLOYMENT_MONTHS[input.deploymentLength];

  // Pre-deployment net
  const currentMonthlyNet = state.income.totalGross - state.expenses.totalMonthly;

  // Deployment pay additions
  let deploymentPayBoost = IMMINENT_DANGER_PAY + HARDSHIP_DUTY_PAY;
  if (input.hasSpouse || state.military.dependents > 0) {
    deploymentPayBoost += FAMILY_SEPARATION_ALLOWANCE;
  }

  // Tax savings for enlisted in combat zone
  const isEnlisted = state.military.payGrade.startsWith('E');
  const taxSavings = isEnlisted
    ? Math.round(state.income.basePay * ENLISTED_TAX_SAVINGS_FACTOR)
    : 0;

  // Deployment net: current income + pay boosts + tax savings + spouse income
  //                 − current expenses + reduced expenses
  const deploymentIncome =
    state.income.totalGross + deploymentPayBoost + taxSavings + input.spouseMonthlyIncome;
  const deploymentExpenses = state.expenses.totalMonthly - input.reducedExpenses;
  const deploymentMonthlyNet = deploymentIncome - Math.max(0, deploymentExpenses);

  const monthlyDelta = deploymentMonthlyNet - currentMonthlyNet;
  const totalImpact = monthlyDelta * months;

  // Emergency buffer calculation
  const recommendedBuffer = RECOMMENDED_BUFFER_MONTHS * state.expenses.totalEssential;
  const currentBuffer = state.assets.emergencyFund + state.assets.savingsBalance;
  const bufferGap = Math.max(0, recommendedBuffer - currentBuffer);

  return {
    currentMonthlyNet: Math.round(currentMonthlyNet),
    deploymentMonthlyNet: Math.round(deploymentMonthlyNet),
    monthlyDelta: Math.round(monthlyDelta),
    deploymentMonths: months,
    totalImpact: Math.round(totalImpact),
    recommendedBuffer: Math.round(recommendedBuffer),
    currentBuffer: Math.round(currentBuffer),
    bufferGap: Math.round(bufferGap),
  };
}

// ────────────────────────────────────────────────────────────
// Bill Audit
// ────────────────────────────────────────────────────────────

interface BillSpec {
  category: string;
  label: string;
  amount: number;
  priority: BillAuditItem['priority'];
}

/**
 * Audit recurring bills and debts for auto-pay setup.
 * Scans FSM expenses and debts, categorizes by priority.
 */
export function auditBills(state: FinancialState): BillAuditItem[] {
  const specs: BillSpec[] = [];

  // Expenses
  if (state.expenses.housing > 0) {
    specs.push({ category: 'housing', label: 'Rent / Mortgage', amount: state.expenses.housing, priority: 'critical' });
  }
  if (state.expenses.insurance > 0) {
    specs.push({ category: 'insurance', label: 'Insurance Premiums', amount: state.expenses.insurance, priority: 'critical' });
  }
  if (state.expenses.utilities > 0) {
    specs.push({ category: 'utilities', label: 'Utilities', amount: state.expenses.utilities, priority: 'important' });
  }
  if (state.expenses.transportation > 0) {
    specs.push({ category: 'transportation', label: 'Transportation / Auto', amount: state.expenses.transportation, priority: 'important' });
  }
  if (state.expenses.childcare > 0) {
    specs.push({ category: 'childcare', label: 'Childcare', amount: state.expenses.childcare, priority: 'critical' });
  }
  if (state.expenses.food > 0) {
    specs.push({ category: 'food', label: 'Groceries / Meal Services', amount: state.expenses.food, priority: 'important' });
  }
  if (state.expenses.subscriptions > 0) {
    specs.push({ category: 'subscriptions', label: 'Subscriptions', amount: state.expenses.subscriptions, priority: 'optional' });
  }
  if (state.expenses.discretionary > 0) {
    specs.push({ category: 'discretionary', label: 'Discretionary Spending', amount: state.expenses.discretionary, priority: 'optional' });
  }

  // Debts
  for (const debt of state.debts) {
    if (debt.monthlyPayment > 0) {
      specs.push({
        category: 'debt',
        label: `${debt.name} (${debt.type})`,
        amount: debt.monthlyPayment,
        priority: 'important',
      });
    }
  }

  // Sort: critical first, then important, then optional
  const priorityOrder = { critical: 0, important: 1, optional: 2 };
  specs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return specs.map((spec) => ({
    category: spec.category,
    label: spec.label,
    monthlyAmount: spec.amount,
    priority: spec.priority,
    recommendation: buildBillRecommendation(spec.priority, spec.category),
  }));
}

function buildBillRecommendation(
  priority: BillAuditItem['priority'],
  category: string,
): string {
  if (priority === 'critical') {
    return 'Set up auto-pay before departure — missed payments impact credit and housing.';
  }
  if (priority === 'optional') {
    if (category === 'subscriptions') {
      return 'Consider pausing or canceling during deployment to save money.';
    }
    return 'Review whether this expense can be reduced during deployment.';
  }
  // important
  if (category === 'debt') {
    return 'Set up auto-pay for at least the minimum payment to protect credit.';
  }
  return 'Set up auto-pay to ensure continuity while deployed.';
}

// ────────────────────────────────────────────────────────────
// Action Generation
// ────────────────────────────────────────────────────────────

/**
 * Generate deployment preparation actions across immediate and stabilization tiers.
 */
export function generateDeploymentActions(
  state: FinancialState,
  input: DeploymentInput,
  budgetImpact: DeploymentBudgetImpact,
  billAudit: BillAuditItem[],
): DeploymentAction[] {
  const actions: DeploymentAction[] = [];

  // ─── Immediate tier ───

  const criticalBills = billAudit.filter((b) => b.priority === 'critical');
  if (criticalBills.length > 0) {
    const billList = criticalBills.map((b) => b.label).join(', ');
    actions.push({
      id: 'deploy_autopay_critical',
      title: 'Set up auto-pay for critical bills',
      description:
        `Configure automatic payments for: ${billList}. ` +
        'This prevents missed payments and credit damage while deployed.',
      mechanism: 'Bank website > Bill Pay > Add Payees > Enable Auto-Pay for each',
      tier: 'immediate',
      difficulty: 'easy',
      estimatedMinutes: 20,
    });
  }

  if (input.hasSpouse) {
    actions.push({
      id: 'deploy_spouse_accounts',
      title: 'Add spouse to all financial accounts',
      description:
        'Ensure your spouse has full access to checking, savings, and credit accounts. ' +
        'Add as joint account holder or authorized user where needed.',
      mechanism: 'Visit bank branch with spouse + two forms of ID, or call bank customer service',
      tier: 'immediate',
      difficulty: 'easy',
      estimatedMinutes: 30,
    });
  }

  actions.push({
    id: 'deploy_sgli_review',
    title: 'Review and verify SGLI beneficiaries',
    description:
      'Confirm SGLI coverage amount and beneficiary designations are current. ' +
      `Current SGLI: $${(state.deductions.sgliCoverage || 0).toLocaleString()}.`,
    mechanism: 'milConnect > SGLI Online Enrollment System (SOES) > Review Beneficiaries',
    tier: 'immediate',
    difficulty: 'easy',
    estimatedMinutes: 10,
  });

  actions.push({
    id: 'deploy_poa',
    title: 'Set up power of attorney',
    description:
      'Execute a Special Power of Attorney for financial matters. ' +
      'This allows your spouse or designee to handle banking, housing, and legal matters.',
    mechanism: 'JAG Office > Request Special POA appointment > Bring ID and list of authorized actions',
    tier: 'immediate',
    difficulty: 'medium',
    estimatedMinutes: 60,
  });

  // ─── Stabilization tier ───

  if (budgetImpact.bufferGap > 0) {
    const monthlyTarget = Math.round(budgetImpact.bufferGap / Math.max(1, DEPLOYMENT_MONTHS[input.deploymentLength]));
    actions.push({
      id: 'deploy_build_buffer',
      title: 'Build emergency buffer before departure',
      description:
        `Emergency fund gap: $${budgetImpact.bufferGap.toLocaleString()}. ` +
        `Target saving $${monthlyTarget.toLocaleString()}/mo to close the gap. ` +
        'Set up a recurring allotment to a dedicated savings account.',
      mechanism: 'myPay > Allotments > Add New > Savings account',
      tier: 'stabilization',
      difficulty: 'medium',
      estimatedMinutes: 15,
    });
  }

  const optionalBills = billAudit.filter((b) => b.priority === 'optional');
  if (optionalBills.length > 0) {
    const savings = optionalBills.reduce((sum, b) => sum + b.monthlyAmount, 0);
    actions.push({
      id: 'deploy_pause_subscriptions',
      title: 'Review and pause non-essential subscriptions',
      description:
        `${optionalBills.length} optional expenses totaling $${savings.toLocaleString()}/mo. ` +
        'Pause or cancel services you won\'t use during deployment.',
      mechanism: 'Review each subscription service > Account Settings > Pause/Cancel',
      tier: 'stabilization',
      difficulty: 'easy',
      estimatedMinutes: 30,
    });
  }

  if (input.hasSpouse) {
    actions.push({
      id: 'deploy_spouse_briefing',
      title: 'Create financial briefing for spouse',
      description:
        'Prepare a document listing all accounts, login info (stored securely), ' +
        'bill due dates, insurance contacts, and emergency financial contacts.',
      mechanism: 'Create a secure shared document or use Fortress spousal summary as a starting point',
      tier: 'stabilization',
      difficulty: 'medium',
      estimatedMinutes: 45,
    });
  }

  if (state.debts.length > 0 && state.military.component === 'reserve') {
    actions.push({
      id: 'deploy_scra_activation',
      title: 'Activate SCRA protections on pre-service debts',
      description:
        'The Servicemembers Civil Relief Act caps interest at 6% on pre-service debts ' +
        'during active duty orders. Contact each lender with a copy of your orders.',
      mechanism: 'Send written SCRA request + copy of orders to each lender\'s SCRA department',
      tier: 'stabilization',
      difficulty: 'medium',
      estimatedMinutes: 45,
    });
  }

  return actions.slice(0, MAX_ACTIONS);
}

// ────────────────────────────────────────────────────────────
// Spousal Summary
// ────────────────────────────────────────────────────────────

/**
 * Build a plain-text spousal handover summary.
 */
export function buildSpousalSummary(
  state: FinancialState,
  billAudit: BillAuditItem[],
): string {
  const criticalBills = billAudit.filter((b) => b.priority === 'critical');
  const totalMonthly = billAudit.reduce((sum, b) => sum + b.monthlyAmount, 0);

  const parts: string[] = [];

  parts.push(
    `Monthly financial obligations total approximately $${totalMonthly.toLocaleString()}.`,
  );

  if (criticalBills.length > 0) {
    const list = criticalBills
      .map((b) => `${b.label} ($${b.monthlyAmount.toLocaleString()}/mo)`)
      .join(', ');
    parts.push(`Critical auto-pay bills: ${list}.`);
  }

  if (state.assets.totalLiquid > 0) {
    parts.push(
      `Available liquid assets: $${state.assets.totalLiquid.toLocaleString()} ` +
      `(checking + savings).`,
    );
  }

  if (state.debts.length > 0) {
    const totalDebtPayments = state.debts.reduce((s, d) => s + d.monthlyPayment, 0);
    parts.push(
      `Debt payments: $${totalDebtPayments.toLocaleString()}/mo across ${state.debts.length} account(s).`,
    );
  }

  parts.push(
    'For emergencies, contact your installation Financial Readiness Program ' +
    'or Military OneSource (1-800-342-9647).',
  );

  return parts.join(' ');
}

// ────────────────────────────────────────────────────────────
// Recommendation Builder
// ────────────────────────────────────────────────────────────

function buildRecommendation(
  input: DeploymentInput,
  budgetImpact: DeploymentBudgetImpact,
): string {
  const parts: string[] = [];

  if (budgetImpact.monthlyDelta > 0) {
    parts.push(
      `Your household cash flow is projected to increase by $${budgetImpact.monthlyDelta.toLocaleString()}/mo ` +
      'during deployment due to combat pay and reduced expenses. ' +
      'Direct the surplus to your emergency fund or accelerate debt payoff.',
    );
  } else if (budgetImpact.monthlyDelta < -200) {
    parts.push(
      `Your household cash flow may decrease by $${Math.abs(budgetImpact.monthlyDelta).toLocaleString()}/mo ` +
      'during deployment. Build an emergency buffer and reduce discretionary spending before departure.',
    );
  } else {
    parts.push(
      'Your household cash flow is expected to remain stable during deployment.',
    );
  }

  if (budgetImpact.bufferGap > 0) {
    parts.push(
      `You need an additional $${budgetImpact.bufferGap.toLocaleString()} in emergency savings ` +
      `to reach the recommended ${RECOMMENDED_BUFFER_MONTHS}-month buffer.`,
    );
  }

  if (input.hasSpouse) {
    parts.push(
      'Ensure your spouse has full account access, a power of attorney, and a clear financial briefing before departure.',
    );
  }

  return parts.join(' ');
}

// ────────────────────────────────────────────────────────────
// Main Orchestrator
// ────────────────────────────────────────────────────────────

/**
 * Calculate a comprehensive deployment preparation plan.
 */
export function calculateDeploymentPlan(
  state: FinancialState,
  input: DeploymentInput,
): DeploymentPlan {
  const budgetImpact = calculateBudgetImpact(state, input);
  const billAudit = auditBills(state);
  const actions = generateDeploymentActions(state, input, budgetImpact, billAudit);
  const spousalSummary = buildSpousalSummary(state, billAudit);
  const recommendation = buildRecommendation(input, budgetImpact);

  return {
    budgetImpact,
    billAudit,
    actions,
    spousalSummary,
    recommendation,
  };
}
