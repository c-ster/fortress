/**
 * Monte Carlo financial path simulator.
 *
 * Pure functions: no side effects, no DOM, no Zustand.
 *
 * Core flow:
 *   1. buildSimInput() flattens FinancialState for the hot loop
 *   2. runSingleIteration() runs one 480-month projection with stochastic TSP returns
 *   3. runSimulation() orchestrates N iterations, collects data, aggregates percentiles
 *   4. runProjection() wraps runSimulation in a Web Worker for non-blocking UI
 *
 * Performance target: 500 iterations × 480 months < 5 seconds.
 */

import type {
  FinancialState,
  SimulationScenario,
  MonthlySnapshot,
  SimulationResult,
  MilestoneEstimate,
} from '@fortress/types';
import { calculateBRSMatch } from './brs-match';
import { applyDebtPayment, type SimDebt } from './debt-strategies';
import { aggregateProjections, type CollectedData } from './aggregation';

// --- Seeded PRNG (mulberry32) ---

/** Create a seeded pseudo-random number generator returning values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller transform: convert uniform [0,1) to standard normal N(0,1). */
function normalRandom(rng: () => number): number {
  const u1 = rng() || 1e-10; // Avoid log(0)
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Generate a monthly log-normal investment return from annual parameters. */
function monthlyLogNormalReturn(
  rng: () => number,
  annualMean: number,
  annualStdDev: number,
): number {
  const monthlyMu = annualMean / 12;
  const monthlySigma = annualStdDev / Math.sqrt(12);
  const z = normalRandom(rng);
  return Math.exp(monthlyMu + monthlySigma * z) - 1;
}

// --- Simulation Input ---

/** Flattened input for the simulation hot loop. */
interface SimInput {
  basePay: number;
  bah: number;
  bas: number;
  otherIncome: number;
  taxRate: number;
  retirementSystem: 'brs' | 'legacy' | 'unknown';
  initialLiquid: number;
  initialTSP: number;
  initialDebts: SimDebt[];
  monthlyExpenses: number;
  essentialExpenses: number;
}

/** Map FinancialState to a flat SimInput for the simulation loop. */
export function buildSimInput(state: FinancialState): SimInput {
  const { income, deductions, expenses, debts, assets, military } = state;

  // Estimate effective tax rate from current deductions
  const totalTax = deductions.federalTax + deductions.stateTax + deductions.fica;
  const taxRate = income.totalTaxable > 0
    ? Math.min(totalTax / income.totalTaxable, 0.50)
    : 0.22;

  return {
    basePay: income.basePay,
    bah: income.bah,
    bas: income.bas,
    otherIncome: income.cola + income.specialPay + income.otherIncome,
    taxRate,
    retirementSystem: military.retirementSystem,
    initialLiquid: assets.totalLiquid,
    initialTSP: assets.tspBalance,
    initialDebts: debts.map((d) => ({
      balance: d.balance,
      apr: d.apr,
      minimumPayment: d.minimumPayment,
    })),
    monthlyExpenses: expenses.totalMonthly,
    essentialExpenses: expenses.totalEssential,
  };
}

// --- Single Iteration ---

/**
 * Run a single Monte Carlo iteration for the given horizon.
 * Returns an array of MonthlySnapshot (one per month).
 */
export function runSingleIteration(
  input: SimInput,
  scenario: SimulationScenario,
  rng: () => number,
): MonthlySnapshot[] {
  let liquidSavings = input.initialLiquid;
  let tspBalance = input.initialTSP;
  let debts = input.initialDebts.map((d) => ({ ...d }));

  const snapshots: MonthlySnapshot[] = [];
  const grossIncome = input.basePay + input.bah + input.bas + input.otherIncome;

  for (let month = 1; month <= scenario.horizonMonths; month++) {
    // 1. TSP employee contribution
    const tspContrib = scenario.tspContributionPct * input.basePay;

    // 2. BRS government match
    const brsMatch = input.retirementSystem === 'brs'
      ? calculateBRSMatch(scenario.tspContributionPct, input.basePay)
      : 0;

    // 3. Stochastic TSP return
    const tspReturn = monthlyLogNormalReturn(
      rng, scenario.tspReturnMean, scenario.tspReturnStdDev,
    );
    tspBalance = (tspBalance + tspContrib + brsMatch) * (1 + tspReturn);

    // 4. After-tax income
    const taxableIncome = input.basePay + input.otherIncome;
    const taxes = taxableIncome * input.taxRate;
    const afterTax = grossIncome - taxes - tspContrib;

    // 5. Debt payments
    const debtResult = applyDebtPayment(debts, scenario.debtStrategy, scenario.extraDebtPayment);
    debts = debtResult.debts;

    // 6. Disposable income
    let disposable = afterTax - input.monthlyExpenses - debtResult.totalPaid + scenario.bahDelta;

    // 7. Lifestyle adjustment
    disposable *= (1 - scenario.lifestyleAdjustmentPct);

    // 8. Savings allotment
    const savingsContrib = Math.min(
      scenario.monthlySavingsAllotment,
      Math.max(0, disposable),
    );
    liquidSavings += savingsContrib;

    // 9. Savings interest
    liquidSavings *= (1 + scenario.savingsReturnMean / 12);

    // 10. Record snapshot
    const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
    const netWorth = liquidSavings + tspBalance - totalDebt;
    const emergencyFundMonths = input.essentialExpenses > 0
      ? liquidSavings / input.essentialExpenses
      : 0;

    snapshots.push({
      month,
      liquidSavings,
      tspBalance,
      totalDebt,
      netWorth,
      disposable,
      emergencyFundMonths,
    });
  }

  return snapshots;
}

// --- Milestone Detection ---

interface MilestoneTracker {
  debt_free: number[];
  emergency_fund_3mo: number[];
  emergency_fund_6mo: number[];
  net_worth_100k: number[];
  net_worth_500k: number[];
}

function computeMilestone(
  months: number[],
  totalRuns: number,
): MilestoneEstimate | null {
  if (months.length === 0) return null;
  months.sort((a, b) => a - b);
  return {
    medianMonth: months[Math.floor(months.length / 2)],
    rangeMonths: [months[0], months[months.length - 1]],
    achievedInAllRuns: months.length === totalRuns,
  };
}

// --- Simulation Orchestrator ---

/**
 * Run the full Monte Carlo simulation: N iterations, percentile aggregation,
 * milestone detection.
 *
 * @param state Current financial state
 * @param scenario Simulation parameters
 * @param onProgress Optional progress callback (0–100)
 */
export function runSimulation(
  state: FinancialState,
  scenario: SimulationScenario,
  onProgress?: (percent: number) => void,
): SimulationResult {
  const input = buildSimInput(state);
  const { horizonMonths, iterations } = scenario;
  const baseSeed = 42;

  // Pre-allocate per-month collection arrays
  const data: CollectedData = {
    liquid: Array.from({ length: horizonMonths }, () => []),
    tsp: Array.from({ length: horizonMonths }, () => []),
    debt: Array.from({ length: horizonMonths }, () => []),
    netWorth: Array.from({ length: horizonMonths }, () => []),
    efMonths: Array.from({ length: horizonMonths }, () => []),
  };

  const hasInitialDebt = input.initialDebts.some((d) => d.balance > 0);
  const milestones: MilestoneTracker = {
    debt_free: [],
    emergency_fund_3mo: [],
    emergency_fund_6mo: [],
    net_worth_100k: [],
    net_worth_500k: [],
  };

  for (let i = 0; i < iterations; i++) {
    const rng = mulberry32(baseSeed + i);
    const snapshots = runSingleIteration(input, scenario, rng);

    // Collect per-month values
    let debtFreeMonth = 0;
    let ef3Month = 0;
    let ef6Month = 0;
    let nw100kMonth = 0;
    let nw500kMonth = 0;

    for (let m = 0; m < horizonMonths; m++) {
      const s = snapshots[m];
      data.liquid[m].push(s.liquidSavings);
      data.tsp[m].push(s.tspBalance);
      data.debt[m].push(s.totalDebt);
      data.netWorth[m].push(s.netWorth);
      data.efMonths[m].push(s.emergencyFundMonths);

      // Track milestones (first occurrence only)
      if (hasInitialDebt && debtFreeMonth === 0 && s.totalDebt <= 0.01) {
        debtFreeMonth = s.month;
      }
      if (ef3Month === 0 && s.emergencyFundMonths >= 3) {
        ef3Month = s.month;
      }
      if (ef6Month === 0 && s.emergencyFundMonths >= 6) {
        ef6Month = s.month;
      }
      if (nw100kMonth === 0 && s.netWorth >= 100_000) {
        nw100kMonth = s.month;
      }
      if (nw500kMonth === 0 && s.netWorth >= 500_000) {
        nw500kMonth = s.month;
      }
    }

    if (debtFreeMonth > 0) milestones.debt_free.push(debtFreeMonth);
    if (ef3Month > 0) milestones.emergency_fund_3mo.push(ef3Month);
    if (ef6Month > 0) milestones.emergency_fund_6mo.push(ef6Month);
    if (nw100kMonth > 0) milestones.net_worth_100k.push(nw100kMonth);
    if (nw500kMonth > 0) milestones.net_worth_500k.push(nw500kMonth);

    // Report progress every 10 iterations
    if (onProgress && i % 10 === 9) {
      onProgress(Math.round(((i + 1) / iterations) * 100));
    }
  }

  return {
    projections: aggregateProjections(data, horizonMonths),
    milestones: {
      debt_free: computeMilestone(milestones.debt_free, iterations),
      emergency_fund_3mo: computeMilestone(milestones.emergency_fund_3mo, iterations),
      emergency_fund_6mo: computeMilestone(milestones.emergency_fund_6mo, iterations),
      net_worth_100k: computeMilestone(milestones.net_worth_100k, iterations),
      net_worth_500k: computeMilestone(milestones.net_worth_500k, iterations),
    },
  };
}

// --- Main Thread Worker API ---

/**
 * Run the financial projection in a Web Worker (non-blocking).
 * Mirrors the parseLES() pattern from les-parser.ts.
 *
 * @param state Current financial state
 * @param scenario Simulation parameters
 * @param onProgress Optional progress callback (0–100)
 */
export async function runProjection(
  state: FinancialState,
  scenario: SimulationScenario,
  onProgress?: (percent: number) => void,
): Promise<SimulationResult> {
  const worker = new Worker(
    new URL('./worker.ts', import.meta.url),
    { type: 'module' },
  );

  try {
    return await new Promise<SimulationResult>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;
        switch (msg.type) {
          case 'progress':
            onProgress?.(msg.percent);
            break;
          case 'result':
            resolve(msg.data as SimulationResult);
            break;
          case 'error':
            reject(new Error(msg.message));
            break;
        }
      };
      worker.onerror = (err) => {
        reject(new Error(err.message || 'Simulation worker failed'));
      };
      worker.postMessage({ type: 'run', state, scenario });
    });
  } finally {
    worker.terminate();
  }
}
