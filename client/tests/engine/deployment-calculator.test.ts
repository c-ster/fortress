import { describe, it, expect } from 'vitest';
import {
  calculateBudgetImpact,
  auditBills,
  generateDeploymentActions,
  buildSpousalSummary,
  calculateDeploymentPlan,
  RECOMMENDED_BUFFER_MONTHS,
} from '../../src/engine/deployment-calculator';
import type { FinancialState, DeploymentInput } from '@fortress/types';

// ── Helpers ────────────────────────────────────────────────

function makeState(overrides: Record<string, unknown> = {}): FinancialState {
  const base: FinancialState = {
    income: {
      basePay: 3800,
      bah: 1800,
      bas: 407,
      cola: 0,
      specialPay: 0,
      otherIncome: 0,
      totalGross: 6007,
      totalTaxable: 3800,
      totalNonTaxable: 2207,
    },
    deductions: {
      federalTax: 380,
      stateTax: 100,
      fica: 290,
      sgli: 25,
      sgliCoverage: 400000,
      tspTraditional: 190,
      tspRoth: 0,
      tspContributionPct: 0.05,
      tricare: 0,
      otherDeductions: 0,
      allotments: [],
    },
    expenses: {
      housing: 1500,
      utilities: 200,
      transportation: 400,
      food: 600,
      childcare: 0,
      insurance: 150,
      subscriptions: 80,
      discretionary: 300,
      totalEssential: 2850,
      totalMonthly: 3230,
    },
    debts: [
      {
        id: 'd1',
        name: 'Car Loan',
        type: 'auto',
        balance: 15000,
        apr: 6.5,
        minimumPayment: 350,
        monthlyPayment: 400,
        preService: false,
      },
    ],
    assets: {
      checkingBalance: 2000,
      savingsBalance: 3000,
      emergencyFund: 3000,
      tspBalance: 25000,
      otherInvestments: 0,
      totalLiquid: 5000,
    },
    military: {
      payGrade: 'E5',
      yearsOfService: 6,
      dependents: 2,
      dutyStation: 'Fort Bragg',
      component: 'active',
      retirementSystem: 'brs',
      scraEligible: false,
    },
    risk: {
      emergencyFundMonths: 1.75,
      debtToIncomeRatio: 0.07,
      highInterestDebtTotal: 0,
      sgliAdequate: false,
      tspMatchCaptured: true,
      scraOpportunity: 0,
      paydaySpikeSeverity: 0,
    },
    meta: {
      dataSource: 'manual',
      lastUpdated: '2025-01-15T00:00:00Z',
      completeness: 0.85,
      confidenceScores: {},
    },
    actionStatuses: {},
    checkIns: [],
  };

  // Apply overrides (shallow merge for nested objects)
  return { ...base, ...(overrides as Partial<FinancialState>) } as FinancialState;
}

function makeInput(overrides: Partial<DeploymentInput> = {}): DeploymentInput {
  return {
    deploymentLength: 'medium',
    hasSpouse: true,
    spouseMonthlyIncome: 0,
    reducedExpenses: 500,
    ...overrides,
  };
}

// ── Budget Impact ──────────────────────────────────────────

describe('calculateBudgetImpact', () => {
  it('E5 with dependents, medium deployment → correct monthly delta', () => {
    const state = makeState();
    const input = makeInput();
    const result = calculateBudgetImpact(state, input);

    expect(result.deploymentMonths).toBe(6);
    expect(result.currentMonthlyNet).toBe(state.income.totalGross - state.expenses.totalMonthly);
    // Deployment adds IDP + HDP + FSA + tax savings + reduced expenses
    expect(result.deploymentMonthlyNet).toBeGreaterThan(result.currentMonthlyNet);
    expect(result.monthlyDelta).toBeGreaterThan(0);
  });

  it('spouse income reduces budget impact', () => {
    const state = makeState();
    const noSpouseIncome = calculateBudgetImpact(state, makeInput({ spouseMonthlyIncome: 0 }));
    const withSpouseIncome = calculateBudgetImpact(state, makeInput({ spouseMonthlyIncome: 2000 }));

    expect(withSpouseIncome.deploymentMonthlyNet).toBe(noSpouseIncome.deploymentMonthlyNet + 2000);
  });

  it('buffer gap calculated correctly — under-funded', () => {
    const state = makeState();
    const result = calculateBudgetImpact(state, makeInput());

    const expected = RECOMMENDED_BUFFER_MONTHS * state.expenses.totalEssential;
    expect(result.recommendedBuffer).toBe(expected);
    expect(result.bufferGap).toBe(Math.max(0, expected - (state.assets.emergencyFund + state.assets.savingsBalance)));
    expect(result.bufferGap).toBeGreaterThan(0);
  });

  it('buffer gap is zero when adequately funded', () => {
    const state = makeState({
      assets: {
        checkingBalance: 5000,
        savingsBalance: 20000,
        emergencyFund: 20000,
        tspBalance: 25000,
        otherInvestments: 0,
        totalLiquid: 25000,
      },
    });
    const result = calculateBudgetImpact(state, makeInput());

    expect(result.bufferGap).toBe(0);
  });

  it('handles zero expenses gracefully', () => {
    const state = makeState({
      expenses: {
        housing: 0, utilities: 0, transportation: 0, food: 0,
        childcare: 0, insurance: 0, subscriptions: 0, discretionary: 0,
        totalEssential: 0, totalMonthly: 0,
      },
    });
    const result = calculateBudgetImpact(state, makeInput());

    expect(result.currentMonthlyNet).toBe(state.income.totalGross);
    expect(result.recommendedBuffer).toBe(0);
    expect(result.bufferGap).toBe(0);
  });

  it('long deployment → 12-month total impact', () => {
    const state = makeState();
    const result = calculateBudgetImpact(state, makeInput({ deploymentLength: 'long' }));

    expect(result.deploymentMonths).toBe(12);
    expect(result.totalImpact).toBe(result.monthlyDelta * 12);
  });
});

// ── Bill Audit ─────────────────────────────────────────────

describe('auditBills', () => {
  it('generates items for non-zero expenses', () => {
    const state = makeState();
    const result = auditBills(state);

    expect(result.length).toBeGreaterThan(0);
    // Should have housing, utilities, transportation, food, insurance,
    // subscriptions, discretionary, plus 1 debt
    expect(result.length).toBe(8);
  });

  it('housing and insurance are critical priority', () => {
    const state = makeState();
    const result = auditBills(state);

    const housing = result.find((b) => b.category === 'housing');
    const insurance = result.find((b) => b.category === 'insurance');
    expect(housing?.priority).toBe('critical');
    expect(insurance?.priority).toBe('critical');
  });

  it('subscriptions are optional priority', () => {
    const state = makeState();
    const result = auditBills(state);

    const subs = result.find((b) => b.category === 'subscriptions');
    expect(subs?.priority).toBe('optional');
  });

  it('excludes zero-value expenses', () => {
    const state = makeState({
      expenses: {
        housing: 1500, utilities: 0, transportation: 0, food: 0,
        childcare: 0, insurance: 0, subscriptions: 0, discretionary: 0,
        totalEssential: 1500, totalMonthly: 1500,
      },
      debts: [],
    });
    const result = auditBills(state);

    expect(result.length).toBe(1);
    expect(result[0].category).toBe('housing');
  });

  it('includes debts with important priority', () => {
    const state = makeState();
    const result = auditBills(state);

    const debtItems = result.filter((b) => b.category === 'debt');
    expect(debtItems.length).toBe(1);
    expect(debtItems[0].priority).toBe('important');
    expect(debtItems[0].monthlyAmount).toBe(400);
  });

  it('sorted by priority: critical first', () => {
    const state = makeState();
    const result = auditBills(state);

    const priorities = result.map((b) => b.priority);
    const criticalIdx = priorities.indexOf('critical');
    const optionalIdx = priorities.indexOf('optional');
    expect(criticalIdx).toBeLessThan(optionalIdx);
  });
});

// ── Deployment Actions ─────────────────────────────────────

describe('generateDeploymentActions', () => {
  it('E5 with buffer gap → includes build emergency fund action', () => {
    const state = makeState();
    const input = makeInput();
    const budget = calculateBudgetImpact(state, input);
    const bills = auditBills(state);
    const actions = generateDeploymentActions(state, input, budget, bills);

    const bufferAction = actions.find((a) => a.id === 'deploy_build_buffer');
    expect(bufferAction).toBeDefined();
    expect(bufferAction!.tier).toBe('stabilization');
  });

  it('all plans include SGLI and POA actions', () => {
    const state = makeState();
    const input = makeInput({ hasSpouse: false });
    const budget = calculateBudgetImpact(state, input);
    const bills = auditBills(state);
    const actions = generateDeploymentActions(state, input, budget, bills);

    expect(actions.find((a) => a.id === 'deploy_sgli_review')).toBeDefined();
    expect(actions.find((a) => a.id === 'deploy_poa')).toBeDefined();
  });

  it('actions have non-empty mechanism fields', () => {
    const state = makeState();
    const input = makeInput();
    const budget = calculateBudgetImpact(state, input);
    const bills = auditBills(state);
    const actions = generateDeploymentActions(state, input, budget, bills);

    for (const action of actions) {
      expect(action.mechanism.length).toBeGreaterThan(0);
    }
  });

  it('max 8 actions enforced', () => {
    const state = makeState();
    const input = makeInput();
    const budget = calculateBudgetImpact(state, input);
    const bills = auditBills(state);
    const actions = generateDeploymentActions(state, input, budget, bills);

    expect(actions.length).toBeLessThanOrEqual(8);
  });

  it('spouse-specific actions when hasSpouse=true', () => {
    const state = makeState();
    const input = makeInput({ hasSpouse: true });
    const budget = calculateBudgetImpact(state, input);
    const bills = auditBills(state);
    const actions = generateDeploymentActions(state, input, budget, bills);

    expect(actions.find((a) => a.id === 'deploy_spouse_accounts')).toBeDefined();
    expect(actions.find((a) => a.id === 'deploy_spouse_briefing')).toBeDefined();
  });

  it('no spouse actions when hasSpouse=false', () => {
    const state = makeState();
    const input = makeInput({ hasSpouse: false });
    const budget = calculateBudgetImpact(state, input);
    const bills = auditBills(state);
    const actions = generateDeploymentActions(state, input, budget, bills);

    expect(actions.find((a) => a.id === 'deploy_spouse_accounts')).toBeUndefined();
    expect(actions.find((a) => a.id === 'deploy_spouse_briefing')).toBeUndefined();
  });
});

// ── Spousal Summary ────────────────────────────────────────

describe('buildSpousalSummary', () => {
  it('includes total monthly obligations', () => {
    const state = makeState();
    const bills = auditBills(state);
    const summary = buildSpousalSummary(state, bills);

    expect(summary).toContain('Monthly financial obligations');
    expect(summary).toContain('$');
  });

  it('lists critical bills', () => {
    const state = makeState();
    const bills = auditBills(state);
    const summary = buildSpousalSummary(state, bills);

    expect(summary).toContain('Critical auto-pay bills');
    expect(summary).toContain('Rent / Mortgage');
  });

  it('includes emergency contact info', () => {
    const state = makeState();
    const bills = auditBills(state);
    const summary = buildSpousalSummary(state, bills);

    expect(summary).toContain('Military OneSource');
  });
});

// ── Full Plan ──────────────────────────────────────────────

describe('calculateDeploymentPlan', () => {
  it('produces valid plan for E5 deployment', () => {
    const state = makeState();
    const input = makeInput();
    const plan = calculateDeploymentPlan(state, input);

    expect(plan.budgetImpact.deploymentMonths).toBe(6);
    expect(plan.billAudit.length).toBeGreaterThan(0);
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.spousalSummary.length).toBeGreaterThan(0);
    expect(plan.recommendation.length).toBeGreaterThan(0);
  });

  it('recommendation text is non-empty', () => {
    const state = makeState();
    const plan = calculateDeploymentPlan(state, makeInput());

    expect(plan.recommendation.length).toBeGreaterThan(10);
  });

  it('all sections populated', () => {
    const state = makeState();
    const plan = calculateDeploymentPlan(state, makeInput());

    expect(plan.budgetImpact).toBeDefined();
    expect(plan.billAudit).toBeDefined();
    expect(plan.actions).toBeDefined();
    expect(plan.spousalSummary).toBeDefined();
    expect(plan.recommendation).toBeDefined();
  });

  it('OPSEC: no specific dates in output', () => {
    const state = makeState();
    const plan = calculateDeploymentPlan(state, makeInput());

    const allText = JSON.stringify(plan);
    // Should not contain any date-like patterns (YYYY-MM-DD or Month DD, YYYY)
    expect(allText).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(allText).not.toMatch(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i);
  });
});
