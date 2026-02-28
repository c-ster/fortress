import { describe, it, expect } from 'vitest';
import {
  calculateDla,
  calculateMileage,
  calculatePerDiem,
  calculateTle,
  calculateDityIncentive,
  calculateStorageCost,
  estimateOopCosts,
  calculatePcsCosts,
  MILEAGE_RATE,
  PER_DIEM_CONUS,
  DITY_INCENTIVE_PCT,
  GOV_COST_PER_LB,
} from '../../src/engine/pcs-calculator';
import type { PcsInput } from '@fortress/types';

// ── Helpers ────────────────────────────────────────────────

function makeInput(overrides: Partial<PcsInput> = {}): PcsInput {
  return {
    currentZip: '22030',
    newZip: '78234',
    payGrade: 'E5',
    dependents: 2,
    moveDate: '2025-07-01',
    distanceMiles: 1200,
    estimatedWeight: 8000,
    moveType: 'dity',
    storageMonths: 1,
    tleDays: 5,
    ...overrides,
  };
}

// ── DLA ────────────────────────────────────────────────────

describe('calculateDla', () => {
  it('returns E5 rate with dependents', () => {
    expect(calculateDla('E5', 2)).toBe(2372);
  });

  it('returns E5 rate without dependents', () => {
    expect(calculateDla('E5', 0)).toBe(1867);
  });

  it('returns higher rate for officer grade', () => {
    expect(calculateDla('O3', 1)).toBe(3226);
    expect(calculateDla('O3', 1)).toBeGreaterThan(calculateDla('E5', 1));
  });

  it('returns minimum DLA for E1', () => {
    expect(calculateDla('E1', 0)).toBe(1629);
    expect(calculateDla('E1', 1)).toBe(2042);
  });
});

// ── Mileage ────────────────────────────────────────────────

describe('calculateMileage', () => {
  it('calculates 500 miles, no dependents → 1 POV', () => {
    const result = calculateMileage(500, 0);
    expect(result).toBeCloseTo(500 * MILEAGE_RATE, 2);
  });

  it('calculates 1000 miles, 2 dependents → 2 POVs', () => {
    const result = calculateMileage(1000, 2);
    expect(result).toBeCloseTo(1000 * MILEAGE_RATE * 2, 2);
  });

  it('returns $0 for zero miles', () => {
    expect(calculateMileage(0, 2)).toBe(0);
  });
});

// ── Per Diem ───────────────────────────────────────────────

describe('calculatePerDiem', () => {
  it('350 miles → 1 travel day', () => {
    expect(calculatePerDiem(350, 0)).toBeCloseTo(PER_DIEM_CONUS, 2);
  });

  it('700 miles → 2 travel days', () => {
    expect(calculatePerDiem(700, 0)).toBeCloseTo(PER_DIEM_CONUS * 2, 2);
  });

  it('adds 75% per diem per dependent', () => {
    const noDeps = calculatePerDiem(350, 0);
    const twoDeps = calculatePerDiem(350, 2);
    expect(twoDeps).toBeCloseTo(noDeps + 2 * PER_DIEM_CONUS * 0.75, 2);
  });

  it('minimum 1 travel day for short distances', () => {
    expect(calculatePerDiem(50, 0)).toBeCloseTo(PER_DIEM_CONUS, 2);
  });
});

// ── TLE ────────────────────────────────────────────────────

describe('calculateTle', () => {
  it('5 days within max → correct amount', () => {
    expect(calculateTle(5, 'E5')).toBe(5 * 290);
  });

  it('15 days → capped at 10', () => {
    expect(calculateTle(15, 'E6')).toBe(10 * 290);
  });
});

// ── DITY Incentive ─────────────────────────────────────────

describe('calculateDityIncentive', () => {
  it('8000 lbs → correct incentive', () => {
    const expected = 8000 * GOV_COST_PER_LB * DITY_INCENTIVE_PCT;
    expect(calculateDityIncentive(8000)).toBeCloseTo(expected, 2);
  });

  it('0 lbs → $0', () => {
    expect(calculateDityIncentive(0)).toBe(0);
  });
});

// ── Storage ────────────────────────────────────────────────

describe('calculateStorageCost', () => {
  it('calculates cost for weight and months', () => {
    expect(calculateStorageCost(8000, 2)).toBeCloseTo(8000 * 0.5 * 2, 2);
  });

  it('caps at 6 months', () => {
    expect(calculateStorageCost(8000, 10)).toBe(calculateStorageCost(8000, 6));
  });

  it('returns 0 for no storage', () => {
    expect(calculateStorageCost(8000, 0)).toBe(0);
  });
});

// ── OOP Estimate ───────────────────────────────────────────

describe('estimateOopCosts', () => {
  it('short move < 500 miles → lower estimates', () => {
    const result = estimateOopCosts(400, 0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.temporaryHousing).toBe(600);
  });

  it('long move > 1500 miles → higher estimates', () => {
    const short = estimateOopCosts(400, 0);
    const long = estimateOopCosts(1500, 0);
    expect(long.total).toBeGreaterThan(short.total);
    expect(long.temporaryHousing).toBe(1200);
  });

  it('increases with dependents', () => {
    const noDeps = estimateOopCosts(1000, 0);
    const withDeps = estimateOopCosts(1000, 2);
    expect(withDeps.total).toBeGreaterThan(noDeps.total);
  });

  it('total equals sum of all line items', () => {
    const r = estimateOopCosts(800, 1);
    const sum =
      r.temporaryHousing + r.travelMeals + r.securityDeposits +
      r.utilitySetup + r.vehicleShipping + r.miscellaneous;
    expect(r.total).toBe(sum);
  });
});

// ── Full Cost Breakdown ────────────────────────────────────

describe('calculatePcsCosts', () => {
  it('produces valid breakdown for E5 DITY move with dependents', () => {
    const input = makeInput();
    const result = calculatePcsCosts(input, 1800, 1600);

    expect(result.allowances.dla).toBe(2372);
    expect(result.allowances.mileage).toBeGreaterThan(0);
    expect(result.allowances.perDiem).toBeGreaterThan(0);
    expect(result.allowances.tle).toBeGreaterThan(0);
    expect(result.allowances.dityIncentive).toBeGreaterThan(0);
    expect(result.totalAllowances).toBeGreaterThan(0);
    expect(result.oopEstimate.total).toBeGreaterThan(0);
    expect(result.recommendation).toBeTruthy();
  });

  it('DITY move includes incentive payment', () => {
    const input = makeInput({ moveType: 'dity' });
    const result = calculatePcsCosts(input, 1800, 1800);
    expect(result.allowances.dityIncentive).toBeGreaterThan(0);
  });

  it('TMO move has $0 DITY incentive', () => {
    const input = makeInput({ moveType: 'tmo' });
    const result = calculatePcsCosts(input, 1800, 1800);
    expect(result.allowances.dityIncentive).toBe(0);
  });

  it('BAH delta calculated correctly — loss', () => {
    const input = makeInput();
    const result = calculatePcsCosts(input, 2000, 1500);
    expect(result.bahDelta.monthlyDelta).toBe(-500);
    expect(result.bahDelta.annualImpact).toBe(-6000);
  });

  it('BAH delta calculated correctly — gain', () => {
    const input = makeInput();
    const result = calculatePcsCosts(input, 1500, 2000);
    expect(result.bahDelta.monthlyDelta).toBe(500);
    expect(result.bahDelta.annualImpact).toBe(6000);
  });

  it('recommendation text is non-empty', () => {
    const input = makeInput();
    const result = calculatePcsCosts(input, 1800, 1800);
    expect(result.recommendation.length).toBeGreaterThan(0);
  });

  it('netCost reflects OOP minus DITY incentive', () => {
    const input = makeInput({ moveType: 'dity' });
    const result = calculatePcsCosts(input, 1800, 1800);
    expect(result.netCost).toBe(
      result.oopEstimate.total - result.allowances.dityIncentive,
    );
  });

  it('netCost for TMO does not subtract DITY incentive', () => {
    const input = makeInput({ moveType: 'tmo' });
    const result = calculatePcsCosts(input, 1800, 1800);
    expect(result.netCost).toBe(result.oopEstimate.total);
  });
});
