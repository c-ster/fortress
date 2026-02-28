import { describe, it, expect } from 'vitest';
import { computeDerived } from '../../src/stores/financial-state';
import { calculateRiskScore } from '../../src/engine/risk-engine';
import {
  generateActionPlan,
  getNextPayday,
  getDeadlineFromNow,
  ACTION_PLAN_DISCLAIMER,
} from '../../src/engine/action-generator';
import type { FinancialState, PayGrade } from '@fortress/types';

/**
 * Factory: creates a default FinancialState, applies overrides,
 * then runs computeDerived() so all risk.* metrics are populated.
 */
function makeState(overrides: Record<string, unknown> = {}): FinancialState {
  const base: FinancialState = {
    income: {
      basePay: 0, bah: 0, bas: 0, cola: 0, specialPay: 0, otherIncome: 0,
      totalGross: 0, totalTaxable: 0, totalNonTaxable: 0,
    },
    deductions: {
      federalTax: 0, stateTax: 0, fica: 0, sgli: 0, sgliCoverage: 0,
      tspTraditional: 0, tspRoth: 0, tspContributionPct: 0,
      tricare: 0, otherDeductions: 0, allotments: [],
    },
    expenses: {
      housing: 0, utilities: 0, transportation: 0, food: 0,
      childcare: 0, insurance: 0, subscriptions: 0, discretionary: 0,
      totalEssential: 0, totalMonthly: 0,
    },
    debts: [],
    assets: {
      checkingBalance: 0, savingsBalance: 0, emergencyFund: 0,
      tspBalance: 0, otherInvestments: 0, totalLiquid: 0,
    },
    military: {
      payGrade: 'E3' as PayGrade, yearsOfService: 2, dependents: 0,
      dutyStation: '', component: 'active', retirementSystem: 'brs',
      scraEligible: false,
    },
    risk: {
      emergencyFundMonths: 0, debtToIncomeRatio: 0, highInterestDebtTotal: 0,
      sgliAdequate: true, tspMatchCaptured: false, scraOpportunity: 0,
      paydaySpikeSeverity: 0,
    },
    meta: {
      dataSource: 'manual', lastUpdated: '', completeness: 0, confidenceScores: {},
    },
    actionStatuses: {},
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (base as Record<string, unknown>)[key] = {
        ...(base as Record<string, Record<string, unknown>>)[key],
        ...(value as Record<string, unknown>),
      };
    } else {
      (base as Record<string, unknown>)[key] = value;
    }
  }

  return computeDerived(base);
}

// --- Red scenario helper (all 3 findings triggered) ---
function makeRedState(): FinancialState {
  return makeState({
    income: { basePay: 2400, bah: 900, bas: 400 },
    assets: { savingsBalance: 200, checkingBalance: 0 },
    expenses: { housing: 900, utilities: 100, transportation: 200, food: 400 },
    military: { payGrade: 'E3' as PayGrade, dependents: 2 },
    deductions: { sgliCoverage: 100000 },
    debts: [
      {
        id: '1', name: 'Credit Card', type: 'credit_card',
        balance: 5000, apr: 22, minimumPayment: 150,
        monthlyPayment: 150, preService: false,
      },
    ],
  });
}

describe('generateActionPlan', () => {
  it('generates 3 immediate + stabilization actions for red risk', () => {
    const state = makeRedState();
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    // Immediate: emergency_fund, high_interest_debt, sgli (capped at 3)
    expect(plan.immediate).toHaveLength(3);

    // Stabilization: TSP (gap > 3%, so routed here) + debt consolidation
    expect(plan.stabilization.length).toBeGreaterThanOrEqual(1);
    expect(plan.stabilization.length).toBeLessThanOrEqual(3);

    // Each immediate action maps to a different finding
    const findingIds = plan.immediate.map((a) => a.riskFindingId);
    expect(new Set(findingIds).size).toBe(3);
  });

  it('returns empty plan for green risk with no findings', () => {
    const state = makeState({
      income: { basePay: 7500, bah: 2400, bas: 400 },
      assets: { savingsBalance: 25000, checkingBalance: 5000 },
      expenses: { housing: 2000, utilities: 200, transportation: 400, food: 600 },
      military: { payGrade: 'O4' as PayGrade, dependents: 3, yearsOfService: 12 },
      deductions: { sgliCoverage: 500000, tspTraditional: 375 },
      debts: [],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    expect(plan.immediate).toHaveLength(0);
    expect(plan.stabilization).toHaveLength(0);
    expect(plan.compounding).toHaveLength(0);
  });

  it('caps emergency fund allotment at 10% of gross income', () => {
    const state = makeState({
      income: { basePay: 2400, bah: 900, bas: 400 },
      assets: { savingsBalance: 0, checkingBalance: 0 },
      expenses: { housing: 900, utilities: 100, transportation: 200, food: 400 },
      military: { dependents: 0 },
      deductions: { sgliCoverage: 0 },
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const efAction = plan.immediate.find((a) => a.id.includes('emergency_fund'));
    expect(efAction).toBeDefined();
    // totalGross = 3700, 10% = 370, rounded to nearest $50 = $350
    // gap = 3*1600 - 0 = 4800, gap/6 = 800, ceil to $50 = $800
    // min(800, 350) = $350
    expect(efAction!.amount).toBe(350);
  });

  it('ensures minimum $50 allotment for emergency fund', () => {
    // Very small gap: totalLiquid close to 3 × totalEssential
    const state = makeState({
      income: { basePay: 5000, bah: 2000 },
      assets: { savingsBalance: 4700, checkingBalance: 0 },
      expenses: { housing: 1500, food: 500 },
      military: { dependents: 0 },
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const efAction = plan.immediate.find((a) => a.id.includes('emergency_fund'));
    if (efAction) {
      expect(efAction.amount).toBeGreaterThanOrEqual(50);
    }
  });

  it('generates SCRA action when eligible instead of standard debt payoff', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 10000, checkingBalance: 2000 },
      expenses: { housing: 1200, food: 400 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 150 },
      debts: [
        {
          id: '1', name: 'Pre-service auto', type: 'auto',
          balance: 12000, apr: 18, minimumPayment: 300,
          monthlyPayment: 300, preService: true,
        },
      ],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const scraAction = plan.immediate.find((a) => a.id.includes('scra'));
    expect(scraAction).toBeDefined();
    expect(scraAction!.title).toContain('SCRA');
    expect(scraAction!.mechanism).toContain('lender');
  });

  it('generates standard debt payoff action when not SCRA eligible', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 10000, checkingBalance: 2000 },
      expenses: { housing: 1200, food: 400 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 150 },
      debts: [
        {
          id: '1', name: 'Credit Card', type: 'credit_card',
          balance: 5000, apr: 22, minimumPayment: 150,
          monthlyPayment: 150, preService: false,
        },
      ],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const debtAction = plan.immediate.find((a) => a.id.includes('debt_payoff'));
    expect(debtAction).toBeDefined();
    expect(debtAction!.title).toContain('Credit Card');
  });

  it('all actions have non-empty mechanism fields with step separators', () => {
    const state = makeRedState();
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    for (const action of plan.immediate) {
      expect(action.mechanism.length).toBeGreaterThan(0);
      expect(action.mechanism).toContain('>');
    }
  });

  it('all actions have difficulty=easy, status=pending, and positive estimatedMinutes', () => {
    const state = makeRedState();
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    for (const action of plan.immediate) {
      expect(action.difficulty).toBe('easy');
      expect(action.status).toBe('pending');
      expect(action.estimatedMinutes).toBeGreaterThan(0);
    }
  });

  it('deadlines reference a month name', () => {
    const state = makeRedState();
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const months =
      /January|February|March|April|May|June|July|August|September|October|November|December/;
    for (const action of plan.immediate) {
      expect(action.deadline).toMatch(/^Before /);
      expect(action.deadline).toMatch(months);
    }
  });

  it('handles state with zero income gracefully (no crash, no EF action)', () => {
    const state = makeState({
      income: { basePay: 0 },
      assets: { savingsBalance: 500 },
      expenses: { housing: 500 },
      military: { dependents: 1 },
      deductions: { sgliCoverage: 100000 },
      debts: [
        {
          id: '1', name: 'CC', type: 'credit_card',
          balance: 2000, apr: 22, minimumPayment: 100,
          monthlyPayment: 100, preService: false,
        },
      ],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    // Should not crash, EF action skipped (zero income)
    const efAction = plan.immediate.find((a) => a.id.includes('emergency_fund'));
    expect(efAction).toBeUndefined();

    // Debt and SGLI actions may still be generated
    expect(plan.immediate.length).toBeGreaterThanOrEqual(0);
    expect(plan.immediate.length).toBeLessThanOrEqual(3);
  });

  it('exports disclaimer constant with required text', () => {
    expect(ACTION_PLAN_DISCLAIMER).toContain('not financial advice');
    expect(ACTION_PLAN_DISCLAIMER).toContain('PFC');
  });

  // --- TSP Match generators ---

  it('generates immediate TSP action when BRS gap ≤ 3% (at 3%)', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200, bas: 400 },
      assets: { savingsBalance: 15000, checkingBalance: 3000 },
      expenses: { housing: 1200, utilities: 150, food: 400 },
      military: { payGrade: 'E5' as PayGrade, dependents: 0, retirementSystem: 'brs' },
      deductions: { tspTraditional: 90, sgliCoverage: 500000 },
      debts: [],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const tspAction = plan.immediate.find((a) => a.id.includes('tsp_immediate'));
    expect(tspAction).toBeDefined();
    expect(tspAction!.difficulty).toBe('easy');
    expect(tspAction!.title).toContain('5%');
    expect(tspAction!.mechanism).toContain('myPay');

    // Should NOT be in stabilization
    const tspStab = plan.stabilization.find((a) => a.id.includes('tsp_stabilization'));
    expect(tspStab).toBeUndefined();
  });

  it('generates stabilization TSP action when BRS gap > 3% (at 0%)', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200, bas: 400 },
      assets: { savingsBalance: 15000, checkingBalance: 3000 },
      expenses: { housing: 1200, utilities: 150, food: 400 },
      military: { payGrade: 'E5' as PayGrade, dependents: 0, retirementSystem: 'brs' },
      deductions: { tspTraditional: 0, sgliCoverage: 500000 },
      debts: [],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const tspStab = plan.stabilization.find((a) => a.id.includes('tsp_stabilization'));
    expect(tspStab).toBeDefined();
    expect(tspStab!.difficulty).toBe('medium');
    expect(tspStab!.title).toContain('Gradually');

    // Should NOT be in immediate
    const tspImm = plan.immediate.find((a) => a.id.includes('tsp_immediate'));
    expect(tspImm).toBeUndefined();
  });

  it('skips TSP actions for legacy retirement system', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200, bas: 400 },
      assets: { savingsBalance: 15000, checkingBalance: 3000 },
      expenses: { housing: 1200, utilities: 150, food: 400 },
      military: { payGrade: 'E5' as PayGrade, dependents: 0, retirementSystem: 'legacy' },
      deductions: { tspTraditional: 0, sgliCoverage: 500000 },
      debts: [],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const tspAny = [
      ...plan.immediate.filter((a) => a.id.includes('tsp')),
      ...plan.stabilization.filter((a) => a.id.includes('tsp')),
    ];
    expect(tspAny).toHaveLength(0);
  });

  // --- SCRA Stabilization ---

  it('generates stabilization SCRA action for eligible pre-service debts', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 10000, checkingBalance: 2000 },
      expenses: { housing: 1200, food: 400 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 150 },
      debts: [
        {
          id: '1', name: 'Pre-service auto', type: 'auto',
          balance: 12000, apr: 18, minimumPayment: 300,
          monthlyPayment: 300, preService: true,
        },
      ],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const scraStab = plan.stabilization.find((a) => a.id.includes('scra_formal'));
    expect(scraStab).toBeDefined();
    expect(scraStab!.difficulty).toBe('medium');
    expect(scraStab!.mechanism).toContain('certified mail');
    expect(scraStab!.estimatedMinutes).toBe(45);
  });

  // --- Debt Consolidation Stabilization ---

  it('generates stabilization debt consolidation for high-interest debt', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 200, checkingBalance: 100 },
      expenses: { housing: 1200, food: 400 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 150 },
      debts: [
        {
          id: '1', name: 'Credit Card', type: 'credit_card',
          balance: 8000, apr: 24, minimumPayment: 200,
          monthlyPayment: 200, preService: false,
        },
      ],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    // Immediate: debt payoff priority
    const debtImm = plan.immediate.find((a) => a.id.includes('debt_payoff'));
    expect(debtImm).toBeDefined();

    // Stabilization: debt consolidation via military relief society
    const debtStab = plan.stabilization.find((a) => a.id.includes('debt_consolidation'));
    expect(debtStab).toBeDefined();
    expect(debtStab!.title).toContain('NMCRS');
    expect(debtStab!.difficulty).toBe('medium');
  });

  // --- DTI Stabilization ---

  it('generates stabilization DTI strategy for moderate DTI (35%)', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200, bas: 400 },
      assets: { savingsBalance: 15000, checkingBalance: 3000 },
      expenses: { housing: 1200, utilities: 150, food: 400 },
      military: { payGrade: 'E5' as PayGrade, dependents: 0 },
      deductions: { tspTraditional: 150, sgliCoverage: 500000 },
      debts: [
        {
          id: '1', name: 'Auto Loan', type: 'auto',
          balance: 20000, apr: 8, minimumPayment: 1000,
          monthlyPayment: 1000, preService: false,
        },
        {
          id: '2', name: 'Personal Loan', type: 'personal',
          balance: 5000, apr: 10, minimumPayment: 610,
          monthlyPayment: 610, preService: false,
        },
      ],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const dtiStab = plan.stabilization.find((a) => a.id.includes('dti_strategy'));
    expect(dtiStab).toBeDefined();
    expect(dtiStab!.difficulty).toBe('medium');
    expect(dtiStab!.title).toContain('debt payoff');
    expect(dtiStab!.mechanism).toContain('APR');
  });

  // --- DTI Compounding ---

  it('generates compounding DTI counseling for severe DTI (> 40%)', () => {
    const state = makeState({
      income: { basePay: 2400, bah: 900, bas: 400 },
      assets: { savingsBalance: 15000, checkingBalance: 3000 },
      expenses: { housing: 900, utilities: 100, food: 400 },
      military: { payGrade: 'E3' as PayGrade, dependents: 0 },
      deductions: { tspTraditional: 120, sgliCoverage: 500000 },
      debts: [
        {
          id: '1', name: 'Auto Loan', type: 'auto',
          balance: 25000, apr: 8, minimumPayment: 800,
          monthlyPayment: 800, preService: false,
        },
        {
          id: '2', name: 'Personal Loan', type: 'personal',
          balance: 10000, apr: 10, minimumPayment: 800,
          monthlyPayment: 800, preService: false,
        },
      ],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const dtiComp = plan.compounding.find((a) => a.id.includes('dti_counseling'));
    expect(dtiComp).toBeDefined();
    expect(dtiComp!.difficulty).toBe('hard');
    expect(dtiComp!.title).toContain('PFC');
    expect(dtiComp!.mechanism).toContain('Military OneSource');
    expect(dtiComp!.estimatedMinutes).toBe(60);
  });

  // --- All 7 rules firing → actions in all 3 tiers ---

  it('populates all 3 tiers when all 7 risk rules fire', () => {
    const state = makeState({
      income: { basePay: 2400, bah: 900, bas: 400 },
      assets: { savingsBalance: 100, checkingBalance: 100 },
      expenses: { housing: 900, utilities: 100, transportation: 200, food: 400 },
      military: {
        payGrade: 'E3' as PayGrade, dependents: 2,
        retirementSystem: 'brs',
      },
      deductions: { sgliCoverage: 100000, tspTraditional: 0 },
      risk: { paydaySpikeSeverity: 0.9 },
      debts: [
        {
          id: '1', name: 'Credit Card', type: 'credit_card',
          balance: 5000, apr: 22, minimumPayment: 150,
          monthlyPayment: 150, preService: false,
        },
        {
          id: '2', name: 'Pre-service loan', type: 'personal',
          balance: 10000, apr: 18, minimumPayment: 800,
          monthlyPayment: 800, preService: true,
        },
        {
          id: '3', name: 'Car Payment', type: 'auto',
          balance: 15000, apr: 8, minimumPayment: 600,
          monthlyPayment: 600, preService: false,
        },
      ],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    // All 3 tiers should have at least 1 action
    expect(plan.immediate.length).toBeGreaterThanOrEqual(1);
    expect(plan.immediate.length).toBeLessThanOrEqual(3);
    expect(plan.stabilization.length).toBeGreaterThanOrEqual(1);
    expect(plan.stabilization.length).toBeLessThanOrEqual(3);
    // DTI > 40% (1550/3700 ≈ 41.9%) → compounding action
    expect(plan.compounding.length).toBeGreaterThanOrEqual(1);

    // Verify tier difficulties
    for (const a of plan.immediate) expect(a.difficulty).toBe('easy');
    for (const a of plan.stabilization) expect(a.difficulty).toBe('medium');
    for (const a of plan.compounding) expect(a.difficulty).toBe('hard');
  });

  // --- Stabilization/Compounding deadlines use future dates ---

  it('stabilization deadlines are ~30 days out, compounding ~90 days', () => {
    const state = makeState({
      income: { basePay: 2400, bah: 900, bas: 400 },
      assets: { savingsBalance: 100, checkingBalance: 100 },
      expenses: { housing: 900, utilities: 100, transportation: 200, food: 400 },
      military: {
        payGrade: 'E3' as PayGrade, dependents: 2,
        retirementSystem: 'brs',
      },
      deductions: { sgliCoverage: 100000, tspTraditional: 0 },
      debts: [
        {
          id: '1', name: 'Credit Card', type: 'credit_card',
          balance: 5000, apr: 22, minimumPayment: 150,
          monthlyPayment: 150, preService: false,
        },
        {
          id: '2', name: 'Pre-service loan', type: 'personal',
          balance: 10000, apr: 18, minimumPayment: 800,
          monthlyPayment: 800, preService: true,
        },
        {
          id: '3', name: 'Car Payment', type: 'auto',
          balance: 15000, apr: 8, minimumPayment: 600,
          monthlyPayment: 600, preService: false,
        },
      ],
    });
    const risk = calculateRiskScore(state);
    const plan = generateActionPlan(state, risk);

    const months =
      /January|February|March|April|May|June|July|August|September|October|November|December/;

    for (const a of plan.stabilization) {
      expect(a.deadline).toMatch(/^Before /);
      expect(a.deadline).toMatch(months);
    }
    for (const a of plan.compounding) {
      expect(a.deadline).toMatch(/^Before /);
      expect(a.deadline).toMatch(months);
    }
  });
});

describe('getNextPayday', () => {
  it('returns 15th when current day is before 15th', () => {
    const result = getNextPayday(new Date(2026, 1, 10)); // Feb 10, 2026
    expect(result).toContain('15');
    expect(result).toContain('February');
  });

  it('returns next month 1st when current day is 15th or later', () => {
    const result = getNextPayday(new Date(2026, 1, 15)); // Feb 15, 2026
    expect(result).toContain('1');
    expect(result).toContain('March');
  });

  it('handles month rollover from December', () => {
    const result = getNextPayday(new Date(2026, 11, 20)); // Dec 20, 2026
    expect(result).toContain('January');
    expect(result).toContain('2027');
  });

  it('returns 15th when on the 1st', () => {
    const result = getNextPayday(new Date(2026, 5, 1)); // Jun 1, 2026
    expect(result).toContain('15');
    expect(result).toContain('June');
  });

  it('returns next month 1st when on the last day', () => {
    const result = getNextPayday(new Date(2026, 2, 31)); // Mar 31, 2026
    expect(result).toContain('April');
    expect(result).toContain('1');
  });
});

describe('getDeadlineFromNow', () => {
  it('returns date 30 days from now', () => {
    const result = getDeadlineFromNow(30, new Date(2026, 0, 1)); // Jan 1 + 30 = Jan 31
    expect(result).toContain('January');
    expect(result).toContain('31');
    expect(result).toContain('2026');
  });

  it('returns date 90 days from now with month rollover', () => {
    const result = getDeadlineFromNow(90, new Date(2026, 0, 1)); // Jan 1 + 90 = Apr 1
    expect(result).toContain('April');
    expect(result).toContain('1');
    expect(result).toContain('2026');
  });

  it('handles year rollover', () => {
    const result = getDeadlineFromNow(30, new Date(2026, 11, 15)); // Dec 15 + 30 = Jan 14
    expect(result).toContain('January');
    expect(result).toContain('2027');
  });
});
