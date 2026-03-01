import { describe, it, expect } from 'vitest';
import type { FinancialState, NewChildInput } from '@fortress/types';
import {
  calculateBahImpact,
  calculateBudgetImpact,
  calculateEmergencyFund,
  calculateTaxBenefits,
  buildNewChildActions,
  buildRecommendation,
  calculateNewChildPlan,
  CHILD_TAX_CREDIT,
  DEP_CARE_FSA_MAX,
  FSGLI_SPOUSE_COST,
  ROUGH_TAX_RATE,
} from '../../src/engine/new-child-calculator';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeState(overrides?: Partial<FinancialState>): FinancialState {
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
      federalTax: 350,
      stateTax: 100,
      fica: 290,
      sgli: 25,
      sgliCoverage: 400000,
      tspTraditional: 380,
      tspRoth: 0,
      tspContributionPct: 10,
      tricare: 0,
      otherDeductions: 0,
      allotments: [],
    },
    expenses: {
      housing: 1800,
      utilities: 200,
      transportation: 500,
      food: 600,
      childcare: 0,
      insurance: 100,
      subscriptions: 50,
      discretionary: 300,
      totalEssential: 3200,
      totalMonthly: 3550,
    },
    debts: [],
    assets: {
      checkingBalance: 3000,
      savingsBalance: 5000,
      emergencyFund: 10000,
      tspBalance: 45000,
      otherInvestments: 0,
      totalLiquid: 18000,
    },
    military: {
      payGrade: 'E6',
      yearsOfService: 8,
      dependents: 0,
      dutyStation: '22042',
      component: 'active',
      retirementSystem: 'brs',
      scraEligible: false,
    },
    risk: {
      emergencyFundMonths: 2.8,
      debtToIncomeRatio: 0,
      highInterestDebtTotal: 0,
      sgliAdequate: true,
      tspMatchCaptured: true,
      scraOpportunity: 0,
      paydaySpikeSeverity: 0,
    },
    meta: {
      dataSource: 'manual',
      lastUpdated: '2025-01-15',
      completeness: 0.85,
      confidenceScores: {},
    },
    actionStatuses: {},
    checkIns: [],
  };

  return { ...base, ...overrides } as FinancialState;
}

function makeInput(overrides?: Partial<NewChildInput>): NewChildInput {
  return {
    expectedMonth: 6,
    currentChildcare: 0,
    estimatedNewChildcare: 1200,
    estimatedSupplies: 250,
    planFSGLI: true,
    planDepCare: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateBahImpact', () => {
  it('shows BAH increase for first child (0→1 dependents)', () => {
    const state = makeState(); // dependents: 0
    const result = calculateBahImpact(state, 2400, 1800);
    expect(result.firstChild).toBe(true);
    expect(result.currentRate).toBe(1800); // without dependents
    expect(result.newRate).toBe(2400); // with dependents
    expect(result.monthlyDelta).toBe(600);
  });

  it('shows no BAH change for second child (1→2 dependents)', () => {
    const state = makeState({ military: { ...makeState().military, dependents: 1 } });
    const result = calculateBahImpact(state, 2400, 1800);
    expect(result.firstChild).toBe(false);
    expect(result.currentRate).toBe(2400); // already with dependents
    expect(result.newRate).toBe(2400);
    expect(result.monthlyDelta).toBe(0);
  });

  it('handles zero BAH rates gracefully', () => {
    const state = makeState();
    const result = calculateBahImpact(state, 0, 0);
    expect(result.monthlyDelta).toBe(0);
    expect(result.firstChild).toBe(true);
  });
});

describe('calculateBudgetImpact', () => {
  it('calculates net delta with BAH increase (first child)', () => {
    const state = makeState();
    const input = makeInput();
    const bahImpact = calculateBahImpact(state, 2400, 1800);

    const result = calculateBudgetImpact(state, input, bahImpact);

    expect(result.additionalChildcare).toBe(1200);
    expect(result.suppliesCost).toBe(250);
    expect(result.fsgliFee).toBe(FSGLI_SPOUSE_COST);
    expect(result.bahIncrease).toBe(600);
    expect(result.totalNewExpenses).toBe(1200 + 250 + FSGLI_SPOUSE_COST);
    // depCareSavings = Math.round((min(1200*12, 5000) * 0.22) / 12) = Math.round(1100/12) = 92
    expect(result.depCareSavings).toBe(92);
    expect(result.netMonthlyDelta).toBe(600 + 92 - 1200 - 250 - FSGLI_SPOUSE_COST);
  });

  it('calculates net delta without BAH increase (existing dependents)', () => {
    const state = makeState({ military: { ...makeState().military, dependents: 2 } });
    const input = makeInput();
    const bahImpact = calculateBahImpact(state, 2400, 1800);

    const result = calculateBudgetImpact(state, input, bahImpact);

    expect(result.bahIncrease).toBe(0);
    expect(result.netMonthlyDelta).toBeLessThan(0); // expenses without BAH offset
  });

  it('excludes FSGLI fee when not planned', () => {
    const state = makeState();
    const input = makeInput({ planFSGLI: false });
    const bahImpact = calculateBahImpact(state, 2400, 1800);

    const result = calculateBudgetImpact(state, input, bahImpact);
    expect(result.fsgliFee).toBe(0);
  });

  it('excludes dep care savings when not planned', () => {
    const state = makeState();
    const input = makeInput({ planDepCare: false });
    const bahImpact = calculateBahImpact(state, 2400, 1800);

    const result = calculateBudgetImpact(state, input, bahImpact);
    expect(result.depCareSavings).toBe(0);
  });

  it('caps FSA at DEP_CARE_FSA_MAX', () => {
    const state = makeState();
    const input = makeInput({ currentChildcare: 1000, estimatedNewChildcare: 2000, planDepCare: true });
    const bahImpact = calculateBahImpact(state, 2400, 1800);

    const result = calculateBudgetImpact(state, input, bahImpact);
    // Total childcare = (1000 + 2000) * 12 = 36000, capped at 5000
    const expectedSavings = Math.round((DEP_CARE_FSA_MAX * ROUGH_TAX_RATE) / 12);
    expect(result.depCareSavings).toBe(expectedSavings);
  });
});

describe('calculateEmergencyFund', () => {
  it('calculates months covered correctly', () => {
    const state = makeState(); // emergencyFund: 10000, totalMonthly: 3550
    const input = makeInput();
    const bahImpact = calculateBahImpact(state, 2400, 1800);
    const budgetImpact = calculateBudgetImpact(state, input, bahImpact);

    const result = calculateEmergencyFund(state, input, budgetImpact);

    const expectedExpenses = 3550 + budgetImpact.totalNewExpenses;
    expect(result.monthlyExpensesAfter).toBe(expectedExpenses);
    expect(result.monthsCovered).toBeCloseTo(10000 / expectedExpenses, 1);
    expect(result.recommended).toBe(expectedExpenses * 3);
  });

  it('shows gap when fund is insufficient', () => {
    const state = makeState({
      assets: { ...makeState().assets, emergencyFund: 2000 },
    });
    const input = makeInput();
    const bahImpact = calculateBahImpact(state, 2400, 1800);
    const budgetImpact = calculateBudgetImpact(state, input, bahImpact);

    const result = calculateEmergencyFund(state, input, budgetImpact);
    expect(result.gap).toBeGreaterThan(0);
    expect(result.monthsCovered).toBeLessThan(3);
  });

  it('shows zero gap when fund is adequate', () => {
    const state = makeState({
      assets: { ...makeState().assets, emergencyFund: 50000 },
    });
    const input = makeInput();
    const bahImpact = calculateBahImpact(state, 2400, 1800);
    const budgetImpact = calculateBudgetImpact(state, input, bahImpact);

    const result = calculateEmergencyFund(state, input, budgetImpact);
    expect(result.gap).toBe(0);
    expect(result.monthsCovered).toBeGreaterThan(3);
  });
});

describe('calculateTaxBenefits', () => {
  it('includes child tax credit', () => {
    const state = makeState();
    const input = makeInput();
    const result = calculateTaxBenefits(state, input);
    expect(result.childTaxCredit).toBe(CHILD_TAX_CREDIT);
  });

  it('calculates dep care FSA savings when planned', () => {
    const state = makeState();
    const input = makeInput({ planDepCare: true, estimatedNewChildcare: 1200, currentChildcare: 0 });
    const result = calculateTaxBenefits(state, input);

    // 1200 * 12 = 14400, capped at 5000, * 0.22 = 1100
    expect(result.depCareFSA).toBe(Math.round(DEP_CARE_FSA_MAX * ROUGH_TAX_RATE));
  });

  it('shows zero FSA savings when not planned', () => {
    const state = makeState();
    const input = makeInput({ planDepCare: false });
    const result = calculateTaxBenefits(state, input);
    expect(result.depCareFSA).toBe(0);
  });

  it('sums annual savings correctly', () => {
    const state = makeState();
    const input = makeInput({ planDepCare: true });
    const result = calculateTaxBenefits(state, input);
    expect(result.estimatedAnnualSavings).toBe(result.childTaxCredit + result.depCareFSA);
  });
});

describe('buildNewChildActions', () => {
  it('includes before-birth actions', () => {
    const state = makeState();
    const input = makeInput();
    const actions = buildNewChildActions(state, input);
    const before = actions.filter((a) => a.timeframe === 'before_birth');
    expect(before.length).toBeGreaterThanOrEqual(4);
  });

  it('includes BAH update action for first child only', () => {
    const state0 = makeState(); // dependents: 0
    const state1 = makeState({ military: { ...makeState().military, dependents: 1 } });
    const input = makeInput();

    const actions0 = buildNewChildActions(state0, input);
    const actions1 = buildNewChildActions(state1, input);

    expect(actions0.find((a) => a.id === 'bah-update')).toBeDefined();
    expect(actions1.find((a) => a.id === 'bah-update')).toBeUndefined();
  });

  it('includes FSGLI action when planned', () => {
    const state = makeState();
    const actions = buildNewChildActions(state, makeInput({ planFSGLI: true }));
    expect(actions.find((a) => a.id === 'fsgli-update')).toBeDefined();
  });

  it('excludes FSGLI action when not planned', () => {
    const state = makeState();
    const actions = buildNewChildActions(state, makeInput({ planFSGLI: false }));
    expect(actions.find((a) => a.id === 'fsgli-update')).toBeUndefined();
  });

  it('includes dep care FSA action when planned', () => {
    const state = makeState();
    const actions = buildNewChildActions(state, makeInput({ planDepCare: true }));
    expect(actions.find((a) => a.id === 'dep-care-fsa')).toBeDefined();
  });

  it('all actions have required fields', () => {
    const state = makeState();
    const input = makeInput();
    const actions = buildNewChildActions(state, input);
    for (const action of actions) {
      expect(action.id).toBeTruthy();
      expect(action.title).toBeTruthy();
      expect(action.description).toBeTruthy();
      expect(action.mechanism).toBeTruthy();
      expect(['admin', 'financial', 'insurance', 'legal']).toContain(action.category);
      expect(['before_birth', 'within_30_days', 'within_90_days']).toContain(action.timeframe);
    }
  });
});

describe('buildRecommendation', () => {
  it('mentions first-child BAH increase', () => {
    const bahImpact = { currentRate: 1800, newRate: 2400, monthlyDelta: 600, firstChild: true };
    const budget = { additionalChildcare: 1200, suppliesCost: 250, fsgliFee: 10, depCareSavings: 92, totalNewExpenses: 1460, bahIncrease: 600, netMonthlyDelta: -768 };
    const emFund = { currentFund: 10000, monthlyExpensesAfter: 5010, monthsCovered: 2, recommended: 15030, gap: 5030 };

    const rec = buildRecommendation(budget, emFund, bahImpact);
    expect(rec).toContain('first-time dependent');
    expect(rec).toContain('600');
  });

  it('mentions no BAH change for existing dependents', () => {
    const bahImpact = { currentRate: 2400, newRate: 2400, monthlyDelta: 0, firstChild: false };
    const budget = { additionalChildcare: 1200, suppliesCost: 250, fsgliFee: 0, depCareSavings: 0, totalNewExpenses: 1450, bahIncrease: 0, netMonthlyDelta: -1450 };
    const emFund = { currentFund: 50000, monthlyExpensesAfter: 5000, monthsCovered: 10, recommended: 15000, gap: 0 };

    const rec = buildRecommendation(budget, emFund, bahImpact);
    expect(rec).toContain('will not change');
  });
});

describe('calculateNewChildPlan', () => {
  it('orchestrates all sections', () => {
    const state = makeState();
    const input = makeInput();
    const plan = calculateNewChildPlan(state, input, 2400, 1800);

    expect(plan.bahImpact).toBeDefined();
    expect(plan.budgetImpact).toBeDefined();
    expect(plan.emergencyFund).toBeDefined();
    expect(plan.taxBenefits).toBeDefined();
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.recommendation).toBeTruthy();
  });

  it('handles E1 with no dependents', () => {
    const state = makeState({
      income: { ...makeState().income, basePay: 2000, bah: 900, totalGross: 3307 },
      military: { ...makeState().military, payGrade: 'E1', yearsOfService: 1, dependents: 0 },
      assets: { ...makeState().assets, emergencyFund: 1000 },
    });
    const input = makeInput({ estimatedNewChildcare: 800, estimatedSupplies: 200 });
    const plan = calculateNewChildPlan(state, input, 1500, 900);

    expect(plan.bahImpact.firstChild).toBe(true);
    expect(plan.bahImpact.monthlyDelta).toBe(600);
    expect(plan.emergencyFund.gap).toBeGreaterThan(0);
  });

  it('handles O5 with 3 existing dependents', () => {
    const state = makeState({
      income: { ...makeState().income, basePay: 9000, bah: 3200, totalGross: 12607 },
      military: { ...makeState().military, payGrade: 'O5', yearsOfService: 18, dependents: 3 },
      assets: { ...makeState().assets, emergencyFund: 30000 },
      expenses: { ...makeState().expenses, childcare: 2000, totalMonthly: 8000 },
    });
    const input = makeInput({ currentChildcare: 2000, estimatedNewChildcare: 1500 });
    const plan = calculateNewChildPlan(state, input, 3200, 2600);

    expect(plan.bahImpact.firstChild).toBe(false);
    expect(plan.bahImpact.monthlyDelta).toBe(0);
    expect(plan.budgetImpact.netMonthlyDelta).toBeLessThan(0);
  });
});
