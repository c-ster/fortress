import { describe, it, expect } from 'vitest';
import { computeDerived } from '../../src/stores/financial-state';
import type { FinancialState, PayGrade } from '@fortress/types';

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

  // Apply deep overrides
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

  return base;
}

describe('computeDerived', () => {
  it('calculates totalGross from all income components', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1500, bas: 400, cola: 100, specialPay: 200, otherIncome: 50 },
    });
    const result = computeDerived(state);
    expect(result.income.totalGross).toBe(5250);
  });

  it('calculates totalTaxable (basePay + specialPay + otherIncome)', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1500, bas: 400, specialPay: 200, otherIncome: 50 },
    });
    const result = computeDerived(state);
    expect(result.income.totalTaxable).toBe(3250);
  });

  it('calculates totalNonTaxable (bah + bas + cola)', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1500, bas: 400, cola: 100 },
    });
    const result = computeDerived(state);
    expect(result.income.totalNonTaxable).toBe(2000);
  });

  it('calculates totalEssential expenses', () => {
    const state = makeState({
      expenses: {
        housing: 1200, utilities: 150, transportation: 300,
        food: 400, childcare: 0, insurance: 100,
      },
    });
    const result = computeDerived(state);
    expect(result.expenses.totalEssential).toBe(2150);
  });

  it('calculates totalMonthly expenses', () => {
    const state = makeState({
      expenses: {
        housing: 1200, utilities: 150, transportation: 300,
        food: 400, childcare: 0, insurance: 100,
        subscriptions: 50, discretionary: 200,
      },
    });
    const result = computeDerived(state);
    expect(result.expenses.totalMonthly).toBe(2400);
  });

  it('calculates totalLiquid assets', () => {
    const state = makeState({
      assets: { checkingBalance: 500, savingsBalance: 2000 },
    });
    const result = computeDerived(state);
    expect(result.assets.totalLiquid).toBe(2500);
  });

  it('calculates tspContributionPct', () => {
    const state = makeState({
      income: { basePay: 3000 },
      deductions: { tspTraditional: 150, tspRoth: 0 },
    });
    const result = computeDerived(state);
    expect(result.deductions.tspContributionPct).toBe(0.05);
  });

  it('handles zero basePay for tspContributionPct', () => {
    const state = makeState({
      income: { basePay: 0 },
      deductions: { tspTraditional: 150 },
    });
    const result = computeDerived(state);
    expect(result.deductions.tspContributionPct).toBe(0);
  });

  it('calculates emergencyFundMonths', () => {
    const state = makeState({
      assets: { checkingBalance: 1000, savingsBalance: 2000 },
      expenses: { housing: 1000, utilities: 200, transportation: 300, food: 500 },
    });
    const result = computeDerived(state);
    // totalLiquid = 3000, totalEssential = 2000
    expect(result.risk.emergencyFundMonths).toBe(1.5);
  });

  it('handles zero expenses for emergencyFundMonths', () => {
    const state = makeState({ assets: { savingsBalance: 5000 } });
    const result = computeDerived(state);
    expect(result.risk.emergencyFundMonths).toBe(0);
  });

  it('calculates debtToIncomeRatio', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1500 },
      debts: [
        { id: '1', name: 'CC', type: 'credit_card', balance: 5000, apr: 22,
          minimumPayment: 150, monthlyPayment: 150, preService: false },
        { id: '2', name: 'Auto', type: 'auto', balance: 15000, apr: 8,
          minimumPayment: 350, monthlyPayment: 350, preService: true },
      ],
    });
    const result = computeDerived(state);
    // totalGross = 4500, total payments = 500
    expect(result.risk.debtToIncomeRatio).toBeCloseTo(500 / 4500, 5);
  });

  it('calculates highInterestDebtTotal', () => {
    const state = makeState({
      debts: [
        { id: '1', name: 'CC1', type: 'credit_card', balance: 3000, apr: 22,
          minimumPayment: 100, monthlyPayment: 100, preService: false },
        { id: '2', name: 'CC2', type: 'credit_card', balance: 2000, apr: 18,
          minimumPayment: 60, monthlyPayment: 60, preService: false },
        { id: '3', name: 'Auto', type: 'auto', balance: 15000, apr: 5,
          minimumPayment: 300, monthlyPayment: 300, preService: true },
      ],
    });
    const result = computeDerived(state);
    expect(result.risk.highInterestDebtTotal).toBe(5000); // 3000 + 2000
  });

  it('calculates sgliAdequate', () => {
    // No dependents → always adequate
    const state1 = makeState({
      military: { dependents: 0 },
      deductions: { sgliCoverage: 0 },
    });
    expect(computeDerived(state1).risk.sgliAdequate).toBe(true);

    // Dependents + max coverage → adequate
    const state2 = makeState({
      military: { dependents: 2 },
      deductions: { sgliCoverage: 500000 },
    });
    expect(computeDerived(state2).risk.sgliAdequate).toBe(true);

    // Dependents + low coverage → inadequate
    const state3 = makeState({
      military: { dependents: 2 },
      deductions: { sgliCoverage: 100000 },
    });
    expect(computeDerived(state3).risk.sgliAdequate).toBe(false);
  });

  it('calculates tspMatchCaptured', () => {
    // BRS at 5% → captured
    const state1 = makeState({
      income: { basePay: 3000 },
      deductions: { tspTraditional: 150 },
      military: { retirementSystem: 'brs' },
    });
    expect(computeDerived(state1).risk.tspMatchCaptured).toBe(true);

    // BRS at 2% → not captured
    const state2 = makeState({
      income: { basePay: 3000 },
      deductions: { tspTraditional: 60 },
      military: { retirementSystem: 'brs' },
    });
    expect(computeDerived(state2).risk.tspMatchCaptured).toBe(false);

    // Legacy → always captured (no match to capture)
    const state3 = makeState({
      income: { basePay: 3000 },
      deductions: { tspTraditional: 0 },
      military: { retirementSystem: 'legacy' },
    });
    expect(computeDerived(state3).risk.tspMatchCaptured).toBe(true);
  });

  it('calculates scraOpportunity', () => {
    const state = makeState({
      debts: [
        { id: '1', name: 'Pre-service auto', type: 'auto', balance: 12000, apr: 18,
          minimumPayment: 300, monthlyPayment: 300, preService: true },
        { id: '2', name: 'Post-service CC', type: 'credit_card', balance: 5000, apr: 22,
          minimumPayment: 150, monthlyPayment: 150, preService: false },
      ],
    });
    const result = computeDerived(state);
    // Only pre-service debt above 6%: $12000 * (0.18 - 0.06) / 12 = $120/month
    expect(result.risk.scraOpportunity).toBeCloseTo(120, 0);
    expect(result.military.scraEligible).toBe(true);
  });

  it('calculates completeness', () => {
    // Empty state → low completeness
    const empty = makeState();
    const emptyResult = computeDerived(empty);
    expect(emptyResult.meta.completeness).toBeLessThan(0.5);

    // Populated state → higher completeness
    const full = makeState({
      income: { basePay: 3000, bah: 1500 },
      military: { payGrade: 'E5', dependents: 2, dutyStation: '92101' },
      assets: { checkingBalance: 500, savingsBalance: 2000 },
      deductions: { tspTraditional: 150, sgliCoverage: 500000 },
      expenses: { housing: 1200, utilities: 150, transportation: 300, food: 400 },
    });
    const fullResult = computeDerived(full);
    expect(fullResult.meta.completeness).toBeGreaterThan(0.7);
  });
});
