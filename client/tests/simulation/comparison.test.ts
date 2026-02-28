import { describe, it, expect } from 'vitest';
import { computeDerived } from '../../src/stores/financial-state';
import { compareScenarios } from '../../src/simulation/comparison';
import type { FinancialState, PayGrade, SimulationScenario } from '@fortress/types';

// --- Factories (mirrored from simulator.test.ts) ---

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
      payGrade: 'E5' as PayGrade, yearsOfService: 4, dependents: 0,
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

function makeScenario(overrides: Partial<SimulationScenario> = {}): SimulationScenario {
  return {
    tspContributionPct: 0.05,
    monthlySavingsAllotment: 200,
    debtStrategy: 'minimum',
    extraDebtPayment: 0,
    housingChoice: 'at_bah',
    bahDelta: 0,
    lifestyleAdjustmentPct: 0,
    horizonMonths: 480,
    iterations: 500,
    tspReturnMean: 0.07,
    tspReturnStdDev: 0.15,
    savingsReturnMean: 0.04,
    ...overrides,
  };
}

function makeE5State(): FinancialState {
  return makeState({
    income: { basePay: 3000, bah: 1200, bas: 400 },
    deductions: { federalTax: 300, stateTax: 100, fica: 230, tspTraditional: 150 },
    expenses: { housing: 1200, utilities: 150, transportation: 300, food: 400 },
    assets: { savingsBalance: 5000, checkingBalance: 2000, tspBalance: 10000 },
    military: { payGrade: 'E5' as PayGrade, yearsOfService: 4, retirementSystem: 'brs' },
    debts: [
      {
        id: '1', name: 'Credit Card', type: 'credit_card',
        balance: 3000, apr: 18, minimumPayment: 90,
        monthlyPayment: 90, preService: false,
      },
      {
        id: '2', name: 'Auto Loan', type: 'auto',
        balance: 12000, apr: 6, minimumPayment: 250,
        monthlyPayment: 250, preService: false,
      },
    ],
  });
}

// ============================================================
// Comparison Engine
// ============================================================

describe('compareScenarios', () => {
  it('higher TSP contribution shows positive additional TSP', () => {
    const state = makeE5State();
    const baseline = makeScenario({
      tspContributionPct: 0.03, horizonMonths: 240, iterations: 50,
    });
    const alt = makeScenario({
      tspContributionPct: 0.05, horizonMonths: 240, iterations: 50,
    });
    const delta = compareScenarios(state, baseline, alt);

    expect(delta.additionalTSPAtRetirement.p50).toBeGreaterThan(0);
    expect(delta.year10.tspBalance.p50).toBeGreaterThan(0);
    expect(delta.year20.tspBalance.p50).toBeGreaterThan(0);
  });

  it('avalanche with extra payment shows interest saved and earlier debt-free', () => {
    const state = makeE5State();
    const baseline = makeScenario({
      debtStrategy: 'minimum', extraDebtPayment: 0,
      horizonMonths: 240, iterations: 50,
    });
    const alt = makeScenario({
      debtStrategy: 'avalanche', extraDebtPayment: 200,
      horizonMonths: 240, iterations: 50,
    });
    const delta = compareScenarios(state, baseline, alt);

    expect(delta.totalInterestSaved.p50).toBeGreaterThan(0);
    expect(delta.debtFreeMonthsEarlier.p50).toBeGreaterThan(0);
  });

  it('identical scenarios produce zero deltas', () => {
    const state = makeE5State();
    const scenario = makeScenario({ horizonMonths: 60, iterations: 50 });
    const delta = compareScenarios(state, scenario, scenario);

    expect(delta.year1.netWorth.p50).toBe(0);
    expect(delta.year1.tspBalance.p50).toBe(0);
    expect(delta.year1.totalDebt.p50).toBe(0);
    expect(delta.year1.liquidSavings.p50).toBe(0);
    expect(delta.additionalTSPAtRetirement.p50).toBe(0);
    expect(delta.debtFreeMonthsEarlier.p50).toBe(0);
    expect(delta.totalInterestSaved.p50).toBe(0);
  });

  it('TSP advantage compounds over time', () => {
    const state = makeE5State();
    const baseline = makeScenario({
      tspContributionPct: 0.03, horizonMonths: 240, iterations: 50,
    });
    const alt = makeScenario({
      tspContributionPct: 0.05, horizonMonths: 240, iterations: 50,
    });
    const delta = compareScenarios(state, baseline, alt);

    expect(delta.year5.tspBalance.p50).toBeGreaterThan(delta.year1.tspBalance.p50);
    expect(delta.year10.tspBalance.p50).toBeGreaterThan(delta.year5.tspBalance.p50);
    expect(delta.year20.tspBalance.p50).toBeGreaterThan(delta.year10.tspBalance.p50);
  });

  it('maintains percentile ordering in all delta bands', () => {
    const state = makeE5State();
    const baseline = makeScenario({
      tspContributionPct: 0.03, horizonMonths: 120, iterations: 100,
    });
    const alt = makeScenario({
      tspContributionPct: 0.05, horizonMonths: 120, iterations: 100,
    });
    const delta = compareScenarios(state, baseline, alt);

    // Check year10 TSP band
    const tsp = delta.year10.tspBalance;
    expect(tsp.p10).toBeLessThanOrEqual(tsp.p25);
    expect(tsp.p25).toBeLessThanOrEqual(tsp.p50);
    expect(tsp.p50).toBeLessThanOrEqual(tsp.p75);
    expect(tsp.p75).toBeLessThanOrEqual(tsp.p90);

    // Check additional TSP summary band
    const addTsp = delta.additionalTSPAtRetirement;
    expect(addTsp.p10).toBeLessThanOrEqual(addTsp.p25);
    expect(addTsp.p25).toBeLessThanOrEqual(addTsp.p50);
    expect(addTsp.p50).toBeLessThanOrEqual(addTsp.p75);
    expect(addTsp.p75).toBeLessThanOrEqual(addTsp.p90);
  });

  it('higher savings allotment produces better liquid savings', () => {
    const state = makeE5State();
    const baseline = makeScenario({
      monthlySavingsAllotment: 100, horizonMonths: 120, iterations: 50,
    });
    const alt = makeScenario({
      monthlySavingsAllotment: 400, horizonMonths: 120, iterations: 50,
    });
    const delta = compareScenarios(state, baseline, alt);

    expect(delta.year1.liquidSavings.p50).toBeGreaterThan(0);
    expect(delta.year5.liquidSavings.p50).toBeGreaterThan(0);
    expect(delta.year10.liquidSavings.p50).toBeGreaterThan(0);
  });

  it('handles state with no debt gracefully', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200, bas: 400 },
      deductions: { federalTax: 300, stateTax: 100, fica: 230 },
      expenses: { housing: 1200, utilities: 150, transportation: 300, food: 400 },
      assets: { savingsBalance: 5000, tspBalance: 10000 },
      military: { payGrade: 'E5' as PayGrade, retirementSystem: 'brs' },
    });
    const baseline = makeScenario({
      tspContributionPct: 0.03, horizonMonths: 60, iterations: 50,
    });
    const alt = makeScenario({
      tspContributionPct: 0.05, horizonMonths: 60, iterations: 50,
    });
    const delta = compareScenarios(state, baseline, alt);

    expect(delta.totalInterestSaved.p50).toBe(0);
    expect(delta.debtFreeMonthsEarlier.p50).toBe(0);
    expect(delta.additionalTSPAtRetirement.p50).toBeGreaterThan(0);
  });

  it('reports progress during comparison', () => {
    const state = makeE5State();
    const scenario = makeScenario({ horizonMonths: 24, iterations: 30 });
    const progressCalls: number[] = [];
    compareScenarios(state, scenario, scenario, (p) => progressCalls.push(p));

    expect(progressCalls.length).toBeGreaterThan(0);
    // Last progress call should be <= 100
    expect(progressCalls[progressCalls.length - 1]).toBeLessThanOrEqual(100);
    // Should be monotonically increasing
    for (let i = 1; i < progressCalls.length; i++) {
      expect(progressCalls[i]).toBeGreaterThanOrEqual(progressCalls[i - 1]);
    }
  });

  it('clamps year checkpoints when horizon is shorter than 20 years', () => {
    const state = makeE5State();
    const baseline = makeScenario({
      tspContributionPct: 0.03, horizonMonths: 24, iterations: 50,
    });
    const alt = makeScenario({
      tspContributionPct: 0.05, horizonMonths: 24, iterations: 50,
    });
    const delta = compareScenarios(state, baseline, alt);

    // All year checkpoints should still produce valid values
    // year5/year10/year20 will all clamp to month 23 (last available)
    expect(delta.year1.tspBalance.p50).toBeGreaterThan(0);
    expect(delta.year20.tspBalance.p50).toBeGreaterThan(0);
    // year20 should equal year10 should equal year5 (all clamped to same month)
    expect(delta.year5.tspBalance.p50).toBe(delta.year10.tspBalance.p50);
    expect(delta.year10.tspBalance.p50).toBe(delta.year20.tspBalance.p50);
  });
});
