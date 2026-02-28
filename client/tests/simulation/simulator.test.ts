import { describe, it, expect } from 'vitest';
import { computeDerived } from '../../src/stores/financial-state';
import { calculateBRSMatch } from '../../src/simulation/brs-match';
import { applyDebtPayment, type SimDebt } from '../../src/simulation/debt-strategies';
import { computePercentiles } from '../../src/simulation/aggregation';
import {
  mulberry32,
  buildSimInput,
  runSingleIteration,
  runSimulation,
} from '../../src/simulation/simulator';
import type { FinancialState, PayGrade, SimulationScenario } from '@fortress/types';

// --- Factories ---

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

// --- Typical E5 state for simulation tests ---

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
// BRS Match
// ============================================================

describe('calculateBRSMatch', () => {
  it('returns full match at 5% contribution on $3000 basePay', () => {
    // auto = $30, tier1 = $90, tier2 = 0.02 * $3000 * 0.5 = $30 → $150
    expect(calculateBRSMatch(0.05, 3000)).toBe(150);
  });

  it('returns partial match at 2% contribution', () => {
    // auto = $30, tier1 = $60, tier2 = $0 → $90
    expect(calculateBRSMatch(0.02, 3000)).toBe(90);
  });

  it('returns only 1% auto at 0% contribution', () => {
    // auto = $30, tier1 = $0, tier2 = $0 → $30
    expect(calculateBRSMatch(0, 3000)).toBe(30);
  });

  it('caps match at 5% even if employee contributes more', () => {
    expect(calculateBRSMatch(0.10, 3000)).toBe(calculateBRSMatch(0.05, 3000));
  });

  it('returns 0 for zero basePay', () => {
    expect(calculateBRSMatch(0.05, 0)).toBe(0);
  });

  it('handles exact 4% boundary (partial tier2)', () => {
    // auto = $30, tier1 = $90, tier2 = 0.01 * $3000 * 0.5 = $15 → $135
    expect(calculateBRSMatch(0.04, 3000)).toBe(135);
  });

  it('handles exact 3% boundary (no tier2)', () => {
    // auto = $30, tier1 = $90, tier2 = $0 → $120
    expect(calculateBRSMatch(0.03, 3000)).toBe(120);
  });
});

// ============================================================
// Debt Strategies
// ============================================================

describe('applyDebtPayment', () => {
  // Debts designed so highest APR ≠ lowest balance:
  // Debt A: low balance ($1000), low APR (6%) — snowball target
  // Debt B: high balance ($10000), high APR (22%) — avalanche target
  const twoDebts: SimDebt[] = [
    { balance: 1000, apr: 6, minimumPayment: 50 },
    { balance: 10000, apr: 22, minimumPayment: 200 },
  ];

  it('applies minimum payments only with "minimum" strategy', () => {
    const { debts, totalPaid } = applyDebtPayment(twoDebts, 'minimum', 0);
    // Interest accrues, then minimums paid
    expect(debts[0].balance).toBeGreaterThan(0);
    expect(debts[1].balance).toBeGreaterThan(0);
    expect(totalPaid).toBeGreaterThan(0);
  });

  it('targets highest APR first with "avalanche" strategy', () => {
    const { debts: avalanche } = applyDebtPayment(twoDebts, 'avalanche', 200);
    const { debts: snowball } = applyDebtPayment(twoDebts, 'snowball', 200);

    // Avalanche sends extra $200 to debt B (22% APR, highest)
    // Snowball sends extra $200 to debt A ($1000, lowest balance)
    // So debt B balance should be lower in avalanche than in snowball
    expect(avalanche[1].balance).toBeLessThan(snowball[1].balance);
  });

  it('targets lowest balance first with "snowball" strategy', () => {
    const { debts: snowball } = applyDebtPayment(twoDebts, 'snowball', 200);
    const { debts: avalanche } = applyDebtPayment(twoDebts, 'avalanche', 200);

    // Snowball sends extra $200 to debt A ($1000, lowest balance)
    // So debt A balance should be lower in snowball than in avalanche
    expect(snowball[0].balance).toBeLessThan(avalanche[0].balance);
  });

  it('handles all debts already paid off', () => {
    const zeroed: SimDebt[] = [
      { balance: 0, apr: 18, minimumPayment: 90 },
      { balance: 0, apr: 6, minimumPayment: 250 },
    ];
    const { totalPaid } = applyDebtPayment(zeroed, 'avalanche', 100);
    expect(totalPaid).toBe(0);
  });

  it('does not produce negative balances when extra exceeds total debt', () => {
    const small: SimDebt[] = [{ balance: 50, apr: 12, minimumPayment: 25 }];
    const { debts } = applyDebtPayment(small, 'avalanche', 500);
    expect(debts[0].balance).toBe(0);
  });

  it('does not mutate the input array', () => {
    const original: SimDebt[] = [
      { balance: 3000, apr: 18, minimumPayment: 90 },
    ];
    const originalBalance = original[0].balance;
    applyDebtPayment(original, 'avalanche', 100);
    expect(original[0].balance).toBe(originalBalance);
  });
});

// ============================================================
// Percentile Computation
// ============================================================

describe('computePercentiles', () => {
  it('computes correct percentiles for uniform data', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const p = computePercentiles(values);
    expect(p.p10).toBe(10);
    expect(p.p25).toBe(25);
    expect(p.p50).toBe(50);
    expect(p.p75).toBe(75);
    expect(p.p90).toBe(90);
  });

  it('handles single value', () => {
    const p = computePercentiles([42]);
    expect(p.p10).toBe(42);
    expect(p.p50).toBe(42);
    expect(p.p90).toBe(42);
  });
});

// ============================================================
// PRNG
// ============================================================

describe('mulberry32', () => {
  it('is deterministic with same seed', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('produces different values with different seeds', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(99);
    const vals1 = Array.from({ length: 10 }, () => rng1());
    const vals2 = Array.from({ length: 10 }, () => rng2());
    // At least some should differ
    expect(vals1).not.toEqual(vals2);
  });
});

// ============================================================
// Single Iteration
// ============================================================

describe('runSingleIteration', () => {
  it('produces correct number of snapshots for given horizon', () => {
    const state = makeE5State();
    const input = buildSimInput(state);
    const scenario = makeScenario({ horizonMonths: 120 });
    const rng = mulberry32(42);
    const snapshots = runSingleIteration(input, scenario, rng);
    expect(snapshots).toHaveLength(120);
  });

  it('is deterministic with same seed', () => {
    const state = makeE5State();
    const input = buildSimInput(state);
    const scenario = makeScenario({ horizonMonths: 60 });

    const run1 = runSingleIteration(input, scenario, mulberry32(42));
    const run2 = runSingleIteration(input, scenario, mulberry32(42));

    expect(run1[59].tspBalance).toBe(run2[59].tspBalance);
    expect(run1[59].liquidSavings).toBe(run2[59].liquidSavings);
  });

  it('produces different results with different seeds', () => {
    const state = makeE5State();
    const input = buildSimInput(state);
    const scenario = makeScenario({ horizonMonths: 60 });

    const run1 = runSingleIteration(input, scenario, mulberry32(42));
    const run2 = runSingleIteration(input, scenario, mulberry32(99));

    // TSP returns are stochastic → balances should differ
    expect(run1[59].tspBalance).not.toBe(run2[59].tspBalance);
  });

  it('has sequential month numbers from 1 to N', () => {
    const state = makeE5State();
    const input = buildSimInput(state);
    const scenario = makeScenario({ horizonMonths: 24 });
    const snapshots = runSingleIteration(input, scenario, mulberry32(42));
    for (let i = 0; i < 24; i++) {
      expect(snapshots[i].month).toBe(i + 1);
    }
  });
});

// ============================================================
// Full Simulation
// ============================================================

describe('runSimulation', () => {
  it('produces percentile bands at each month with correct length', () => {
    const state = makeE5State();
    const scenario = makeScenario({ horizonMonths: 60, iterations: 50 });
    const result = runSimulation(state, scenario);

    expect(result.projections).toHaveLength(60);
    expect(result.projections[0].month).toBe(1);
    expect(result.projections[59].month).toBe(60);
  });

  it('maintains p10 <= p25 <= p50 <= p75 <= p90 ordering', () => {
    const state = makeE5State();
    const scenario = makeScenario({ horizonMonths: 60, iterations: 100 });
    const result = runSimulation(state, scenario);

    for (const proj of result.projections) {
      const { tspBalance } = proj;
      expect(tspBalance.p10).toBeLessThanOrEqual(tspBalance.p25);
      expect(tspBalance.p25).toBeLessThanOrEqual(tspBalance.p50);
      expect(tspBalance.p50).toBeLessThanOrEqual(tspBalance.p75);
      expect(tspBalance.p75).toBeLessThanOrEqual(tspBalance.p90);
    }
  });

  it('higher TSP % produces better median TSP at all sampled horizons', () => {
    const state = makeE5State();

    const low = runSimulation(state, makeScenario({
      tspContributionPct: 0.03, horizonMonths: 480, iterations: 100,
    }));
    const high = runSimulation(state, makeScenario({
      tspContributionPct: 0.05, horizonMonths: 480, iterations: 100,
    }));

    // Check at months 12, 60, 120, 240, 480
    for (const m of [11, 59, 119, 239, 479]) {
      expect(high.projections[m].tspBalance.p50).toBeGreaterThan(
        low.projections[m].tspBalance.p50,
      );
    }
  });

  it('detects debt-free milestone when debts exist', () => {
    const state = makeE5State();
    const scenario = makeScenario({
      horizonMonths: 480, iterations: 50, extraDebtPayment: 200,
      debtStrategy: 'avalanche',
    });
    const result = runSimulation(state, scenario);

    expect(result.milestones.debt_free).not.toBeNull();
    expect(result.milestones.debt_free!.medianMonth).toBeGreaterThan(0);
    expect(result.milestones.debt_free!.medianMonth).toBeLessThan(480);
  });

  it('detects emergency fund milestones', () => {
    const state = makeE5State();
    const scenario = makeScenario({
      horizonMonths: 480, iterations: 50, monthlySavingsAllotment: 300,
    });
    const result = runSimulation(state, scenario);

    // Should reach 3-month EF within the horizon
    expect(result.milestones.emergency_fund_3mo).not.toBeNull();
    if (result.milestones.emergency_fund_3mo) {
      expect(result.milestones.emergency_fund_3mo.medianMonth).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Performance
// ============================================================

describe('performance', () => {
  it('completes 500 iterations x 480 months in under 5 seconds', () => {
    const state = makeE5State();
    const scenario = makeScenario({ iterations: 500, horizonMonths: 480 });
    const start = performance.now();
    const result = runSimulation(state, scenario);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5000);
    expect(result.projections).toHaveLength(480);
  });
});
