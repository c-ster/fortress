import { describe, it, expect } from 'vitest';
import {
  calculateRetirementPay,
  calculateIncomeComparison,
  calculateBenefitsTransition,
  calculateTspSummary,
  calculateEmergencyAdequacy,
  buildTransitionChecklists,
  calculateTransitionPlan,
  RETIREMENT_MULTIPLIER_BRS,
  RETIREMENT_MULTIPLIER_LEGACY,
  VA_DISABILITY_RATES,
} from '../../src/engine/transition-calculator';
import type { FinancialState, TransitionInput } from '@fortress/types';

// --- Factories ---

function makeState(overrides: Partial<FinancialState> = {}): FinancialState {
  return {
    income: {
      basePay: 3637, bah: 1800, bas: 407, cola: 0,
      specialPay: 0, otherIncome: 0,
      totalGross: 5844, totalTaxable: 3637, totalNonTaxable: 2207,
    },
    deductions: {
      federalTax: 400, stateTax: 150, fica: 278, sgli: 27,
      sgliCoverage: 400_000, tspTraditional: 0, tspRoth: 73,
      tspContributionPct: 0.02, tricare: 0, otherDeductions: 0,
      allotments: [],
    },
    expenses: {
      housing: 1800, utilities: 200, transportation: 350,
      food: 400, childcare: 0, insurance: 100,
      subscriptions: 80, discretionary: 300,
      totalEssential: 2850, totalMonthly: 3230,
    },
    debts: [
      {
        id: '1', name: 'Car Loan', type: 'auto', balance: 12000,
        apr: 6.5, minimumPayment: 280, monthlyPayment: 280, preService: true,
      },
    ],
    assets: {
      checkingBalance: 5000, savingsBalance: 15000,
      emergencyFund: 0, tspBalance: 45000,
      otherInvestments: 0, totalLiquid: 20000,
    },
    military: {
      payGrade: 'E7', yearsOfService: 20, dependents: 2,
      dutyStation: 'Fort Liberty', component: 'active',
      retirementSystem: 'brs', scraEligible: false,
    },
    risk: {
      emergencyFundMonths: 6.2, debtToIncomeRatio: 0.05,
      highInterestDebtTotal: 0, sgliAdequate: false,
      tspMatchCaptured: false, scraOpportunity: 0,
      paydaySpikeSeverity: 0,
    },
    meta: {
      dataSource: 'manual', lastUpdated: '2025-01-15',
      completeness: 0.85, confidenceScores: {},
    },
    actionStatuses: {},
    checkIns: [],
    ...overrides,
  };
}

function makeInput(overrides: Partial<TransitionInput> = {}): TransitionInput {
  return {
    separationType: 'retirement',
    monthsUntilSeparation: 12,
    expectedCivilianIncome: 5000,
    civilianHealthInsuranceCost: 600,
    tspAction: 'leave',
    tspWithdrawalPct: 0,
    brsLumpSumPct: 0,
    vaDisabilityRating: 30,
    ...overrides,
  };
}

// --- Tests ---

describe('calculateRetirementPay', () => {
  it('calculates BRS retirement at 20 years (40%)', () => {
    const result = calculateRetirementPay(makeState(), makeInput());
    expect(result.eligible).toBe(true);
    expect(result.system).toBe('brs');
    expect(result.multiplier).toBe(RETIREMENT_MULTIPLIER_BRS);
    // 3637 * 12 * 0.02 * 20 = 17,458
    expect(result.annualRetirementPay).toBe(Math.round(3637 * 12 * 0.02 * 20));
    expect(result.monthlyRetirementPay).toBe(Math.round(result.annualRetirementPay / 12));
  });

  it('calculates Legacy retirement at 20 years (50%)', () => {
    const state = makeState({
      military: {
        payGrade: 'E7', yearsOfService: 20, dependents: 2,
        dutyStation: 'Fort Liberty', component: 'active',
        retirementSystem: 'legacy', scraEligible: false,
      },
    });
    const result = calculateRetirementPay(state, makeInput());
    expect(result.eligible).toBe(true);
    expect(result.multiplier).toBe(RETIREMENT_MULTIPLIER_LEGACY);
    expect(result.annualRetirementPay).toBe(Math.round(3637 * 12 * 0.025 * 20));
  });

  it('returns not eligible for < 20 years retirement', () => {
    const state = makeState({
      military: {
        payGrade: 'E5', yearsOfService: 6, dependents: 0,
        dutyStation: 'Camp Pendleton', component: 'active',
        retirementSystem: 'brs', scraEligible: false,
      },
    });
    const result = calculateRetirementPay(state, makeInput());
    expect(result.eligible).toBe(false);
    expect(result.monthlyRetirementPay).toBe(0);
  });

  it('returns not eligible for ETS separation', () => {
    const result = calculateRetirementPay(makeState(), makeInput({ separationType: 'ets' }));
    expect(result.eligible).toBe(false);
  });

  it('calculates BRS lump sum option', () => {
    const result = calculateRetirementPay(makeState(), makeInput({ brsLumpSumPct: 25 }));
    expect(result.eligible).toBe(true);
    expect(result.brsLumpSum).toBeGreaterThan(0);
    expect(result.reducedMonthlyIfLumpSum).toBeLessThan(result.monthlyRetirementPay);
  });

  it('returns zero lump sum for Legacy retirees', () => {
    const state = makeState({
      military: {
        payGrade: 'E7', yearsOfService: 20, dependents: 2,
        dutyStation: 'Fort Liberty', component: 'active',
        retirementSystem: 'legacy', scraEligible: false,
      },
    });
    const result = calculateRetirementPay(state, makeInput({ brsLumpSumPct: 25 }));
    expect(result.brsLumpSum).toBe(0);
  });
});

describe('calculateIncomeComparison', () => {
  it('computes positive delta when civilian income exceeds military', () => {
    const retPay = calculateRetirementPay(makeState(), makeInput());
    const result = calculateIncomeComparison(
      makeState(),
      makeInput({ expectedCivilianIncome: 8000 }),
      retPay,
    );
    expect(result.totalPostServiceIncome).toBeGreaterThan(0);
    expect(result.currentMilitaryGross).toBe(5844);
  });

  it('computes negative delta when income drops', () => {
    const state = makeState();
    const input = makeInput({ expectedCivilianIncome: 2000, vaDisabilityRating: 0 });
    const retPay = calculateRetirementPay(state, makeInput({ separationType: 'ets' }));
    const result = calculateIncomeComparison(state, input, retPay);
    expect(result.monthlyDelta).toBeLessThan(0);
  });

  it('includes VA disability as tax-free income', () => {
    const retPay = calculateRetirementPay(makeState(), makeInput());
    const with30 = calculateIncomeComparison(makeState(), makeInput({ vaDisabilityRating: 30 }), retPay);
    const with0 = calculateIncomeComparison(makeState(), makeInput({ vaDisabilityRating: 0 }), retPay);
    expect(with30.vaDisabilityIncome).toBe(VA_DISABILITY_RATES[30]);
    expect(with30.totalPostServiceIncome).toBeGreaterThan(with0.totalPostServiceIncome);
  });

  it('handles zero civilian income', () => {
    const retPay = calculateRetirementPay(makeState(), makeInput());
    const result = calculateIncomeComparison(
      makeState(),
      makeInput({ expectedCivilianIncome: 0 }),
      retPay,
    );
    expect(result.projectedCivilianNet).toBe(0);
    expect(result.totalPostServiceIncome).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateBenefitsTransition', () => {
  it('computes health cost delta', () => {
    const result = calculateBenefitsTransition(makeState(), makeInput());
    expect(result.healthCostDelta).toBe(600); // 600 - 0 (TRICARE active = $0)
    expect(result.civilianHealthCost).toBe(600);
    expect(result.tricareCost).toBe(0);
  });

  it('returns SGLI coverage and VGLI estimate', () => {
    const result = calculateBenefitsTransition(makeState(), makeInput());
    expect(result.sgliCoverage).toBe(400_000);
    expect(result.vgliEstimatedCost).toBeGreaterThan(0);
  });

  it('marks GI Bill eligible for 3+ year active duty', () => {
    const result = calculateBenefitsTransition(makeState(), makeInput());
    expect(result.giEligible).toBe(true);
  });

  it('marks GI Bill ineligible for < 3 years', () => {
    const state = makeState({
      military: {
        payGrade: 'E3', yearsOfService: 2, dependents: 0,
        dutyStation: 'Fort Benning', component: 'active',
        retirementSystem: 'brs', scraEligible: false,
      },
    });
    const result = calculateBenefitsTransition(state, makeInput());
    expect(result.giEligible).toBe(false);
  });
});

describe('calculateTspSummary', () => {
  it('describes leave action', () => {
    const result = calculateTspSummary(makeState(), makeInput({ tspAction: 'leave' }));
    expect(result.action).toContain('Leave');
    expect(result.taxImplication).toContain('No tax event');
    expect(result.balance).toBe(45000);
  });

  it('describes rollover action', () => {
    const result = calculateTspSummary(makeState(), makeInput({ tspAction: 'rollover_ira' }));
    expect(result.action).toContain('Roll over');
    expect(result.taxImplication).toContain('IRA');
  });

  it('describes partial withdrawal with tax estimate', () => {
    const result = calculateTspSummary(
      makeState(),
      makeInput({ tspAction: 'partial_withdrawal', tspWithdrawalPct: 50 }),
    );
    expect(result.action).toContain('50%');
    expect(result.taxImplication).toContain('tax');
  });
});

describe('calculateEmergencyAdequacy', () => {
  it('computes months of coverage', () => {
    const result = calculateEmergencyAdequacy(makeState(), makeInput());
    // totalLiquid=20000, totalMonthly=3230+600=3830
    expect(result.months).toBeGreaterThan(0);
    expect(result.recommended).toBe(Math.round(3830 * 6));
  });

  it('identifies gap when savings are insufficient', () => {
    const state = makeState({
      assets: {
        checkingBalance: 500, savingsBalance: 500,
        emergencyFund: 0, tspBalance: 45000,
        otherInvestments: 0, totalLiquid: 1000,
      },
    });
    const result = calculateEmergencyAdequacy(state, makeInput());
    expect(result.gap).toBeGreaterThan(0);
    expect(result.months).toBeLessThan(6);
  });

  it('returns zero gap when fund is adequate', () => {
    const state = makeState({
      assets: {
        checkingBalance: 15000, savingsBalance: 15000,
        emergencyFund: 0, tspBalance: 45000,
        otherInvestments: 0, totalLiquid: 30000,
      },
    });
    const result = calculateEmergencyAdequacy(state, makeInput());
    expect(result.gap).toBe(0);
  });
});

describe('buildTransitionChecklists', () => {
  it('returns all 4 phases for 12+ months out', () => {
    const result = buildTransitionChecklists(makeState(), makeInput({ monthsUntilSeparation: 12 }));
    expect(result).toHaveLength(4);
    expect(result.map((c) => c.phase)).toEqual(['12_months', '6_months', '90_days', '30_days']);
  });

  it('returns 3 phases for 6 months out', () => {
    const result = buildTransitionChecklists(makeState(), makeInput({ monthsUntilSeparation: 6 }));
    expect(result).toHaveLength(3);
    expect(result[0].phase).toBe('6_months');
  });

  it('returns only 30-day phase for 1 month out', () => {
    const result = buildTransitionChecklists(makeState(), makeInput({ monthsUntilSeparation: 1 }));
    expect(result).toHaveLength(1);
    expect(result[0].phase).toBe('30_days');
  });

  it('includes retirement-specific items for retirees', () => {
    const result = buildTransitionChecklists(makeState(), makeInput({ separationType: 'retirement', monthsUntilSeparation: 6 }));
    const phase90 = result.find((c) => c.phase === '90_days');
    expect(phase90?.items.some((i) => i.id === 'retirement-app')).toBe(true);
  });

  it('all items have required fields', () => {
    const result = buildTransitionChecklists(makeState(), makeInput());
    for (const checklist of result) {
      expect(checklist.label).toBeTruthy();
      for (const item of checklist.items) {
        expect(item.id).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.description).toBeTruthy();
        expect(item.mechanism).toBeTruthy();
        expect(['financial', 'benefits', 'career', 'legal']).toContain(item.category);
      }
    }
  });
});

describe('calculateTransitionPlan', () => {
  it('produces all sections', () => {
    const plan = calculateTransitionPlan(makeState(), makeInput());
    expect(plan.retirementPay).toBeDefined();
    expect(plan.incomeComparison).toBeDefined();
    expect(plan.benefits).toBeDefined();
    expect(plan.tspSummary).toBeDefined();
    expect(plan.emergencyFundAdequacy).toBeDefined();
    expect(plan.checklists.length).toBeGreaterThan(0);
    expect(plan.recommendation).toBeTruthy();
  });

  it('handles E1 ETS with zero civilian income', () => {
    const state = makeState({
      income: {
        basePay: 1833, bah: 800, bas: 407, cola: 0,
        specialPay: 0, otherIncome: 0,
        totalGross: 3040, totalTaxable: 1833, totalNonTaxable: 1207,
      },
      military: {
        payGrade: 'E1', yearsOfService: 2, dependents: 0,
        dutyStation: 'Fort Sill', component: 'active',
        retirementSystem: 'brs', scraEligible: false,
      },
    });
    const input = makeInput({
      separationType: 'ets',
      expectedCivilianIncome: 0,
      vaDisabilityRating: 0,
    });
    const plan = calculateTransitionPlan(state, input);
    expect(plan.retirementPay.eligible).toBe(false);
    expect(plan.incomeComparison.totalPostServiceIncome).toBe(0);
  });

  it('handles O5 retirement with high civilian income', () => {
    const state = makeState({
      income: {
        basePay: 9640, bah: 2400, bas: 296, cola: 0,
        specialPay: 0, otherIncome: 0,
        totalGross: 12336, totalTaxable: 9640, totalNonTaxable: 2696,
      },
      military: {
        payGrade: 'O5', yearsOfService: 22, dependents: 3,
        dutyStation: 'Pentagon', component: 'active',
        retirementSystem: 'legacy', scraEligible: false,
      },
      assets: {
        checkingBalance: 20000, savingsBalance: 50000,
        emergencyFund: 0, tspBalance: 350000,
        otherInvestments: 100000, totalLiquid: 70000,
      },
    });
    const input = makeInput({
      separationType: 'retirement',
      expectedCivilianIncome: 12000,
      vaDisabilityRating: 10,
    });
    const plan = calculateTransitionPlan(state, input);
    expect(plan.retirementPay.eligible).toBe(true);
    expect(plan.retirementPay.system).toBe('legacy');
    expect(plan.retirementPay.monthlyRetirementPay).toBeGreaterThan(0);
  });
});
