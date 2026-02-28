/**
 * PCS (Permanent Change of Station) cost calculator — pure functions.
 *
 * Estimates military relocation allowances, compares DITY vs TMO moves,
 * projects BAH delta impact, and generates a full cost breakdown.
 *
 * No React, no side effects. BAH values passed in as params to stay pure.
 *
 * Key rates are 2025 federal figures (DFAS / JTR).
 */

import type {
  PayGrade,
  PcsInput,
  PcsAllowances,
  PcsBahDelta,
  PcsOopEstimate,
  PcsCostBreakdown,
} from '@fortress/types';

// ────────────────────────────────────────────────────────────
// Constants — 2025 federal rates
// ────────────────────────────────────────────────────────────

/** PCS POV mileage rate ($/mile) — lower than IRS standard rate */
export const MILEAGE_RATE = 0.22;

/** CONUS base per diem (lodging + M&IE) $/day */
export const PER_DIEM_CONUS = 157;

/** TLE daily maximum for E1–E5 */
const TLE_DAILY_MAX_E5_BELOW = 290;

/** TLE daily maximum for E6+ and officers */
const TLE_DAILY_MAX_E6_ABOVE = 290;

/** DITY/PPM incentive = 95% of government cost estimate */
export const DITY_INCENTIVE_PCT = 0.95;

/** Approximate government HHG shipping cost per pound */
export const GOV_COST_PER_LB = 1.2;

/** Monthly SIT (Storage in Transit) cost per pound */
const STORAGE_COST_PER_LB = 0.5;

/** Authorized travel days: 1 per 350 miles */
const MILES_PER_TRAVEL_DAY = 350;

/** Dependent per diem rate as fraction of SM rate (simplified — all deps) */
const DEPENDENT_PER_DIEM_FACTOR = 0.75;

/** Maximum POVs authorized for mileage reimbursement */
const MAX_POVS = 2;

/** Maximum TLE days */
const MAX_TLE_DAYS = 10;

/** Maximum SIT months */
const MAX_SIT_MONTHS = 6;

// ────────────────────────────────────────────────────────────
// DLA Table — 2025 DFAS rates (with / without dependents)
// ────────────────────────────────────────────────────────────

interface DlaEntry {
  withDependents: number;
  withoutDependents: number;
}

const DLA_TABLE: Record<string, DlaEntry> = {
  // Enlisted
  E1: { withDependents: 2042, withoutDependents: 1629 },
  E2: { withDependents: 2042, withoutDependents: 1629 },
  E3: { withDependents: 2042, withoutDependents: 1629 },
  E4: { withDependents: 2372, withoutDependents: 1867 },
  E5: { withDependents: 2372, withoutDependents: 1867 },
  E6: { withDependents: 2607, withoutDependents: 2067 },
  E7: { withDependents: 2607, withoutDependents: 2067 },
  E8: { withDependents: 2861, withoutDependents: 2275 },
  E9: { withDependents: 2861, withoutDependents: 2275 },
  // Warrant Officers
  W1: { withDependents: 2607, withoutDependents: 2067 },
  W2: { withDependents: 2607, withoutDependents: 2067 },
  W3: { withDependents: 2861, withoutDependents: 2275 },
  W4: { withDependents: 3226, withoutDependents: 2561 },
  W5: { withDependents: 3226, withoutDependents: 2561 },
  // Officers
  O1: { withDependents: 3226, withoutDependents: 2561 },
  O1E: { withDependents: 3226, withoutDependents: 2561 },
  O2: { withDependents: 3226, withoutDependents: 2561 },
  O2E: { withDependents: 3226, withoutDependents: 2561 },
  O3: { withDependents: 3226, withoutDependents: 2561 },
  O3E: { withDependents: 3226, withoutDependents: 2561 },
  O4: { withDependents: 3580, withoutDependents: 2855 },
  O5: { withDependents: 3580, withoutDependents: 2855 },
};

// ────────────────────────────────────────────────────────────
// Individual Allowance Calculators
// ────────────────────────────────────────────────────────────

/**
 * Dislocation Allowance — one-time lump sum based on grade and dependency status.
 */
export function calculateDla(payGrade: PayGrade, dependents: number): number {
  const entry = DLA_TABLE[payGrade];
  if (!entry) return 0;
  return dependents > 0 ? entry.withDependents : entry.withoutDependents;
}

/**
 * POV mileage reimbursement.
 * Service member always gets 1 POV. If dependents > 0, 1 additional POV (max 2 total).
 */
export function calculateMileage(distanceMiles: number, dependents: number): number {
  if (distanceMiles <= 0) return 0;
  const povCount = Math.min(dependents > 0 ? 2 : 1, MAX_POVS);
  return Math.round(distanceMiles * MILEAGE_RATE * povCount * 100) / 100;
}

/**
 * Per diem for authorized travel days.
 * 1 travel day per 350 miles (minimum 1). Dependents get 75% of SM rate each.
 */
export function calculatePerDiem(distanceMiles: number, dependents: number): number {
  if (distanceMiles <= 0) return 0;
  const travelDays = Math.max(1, Math.ceil(distanceMiles / MILES_PER_TRAVEL_DAY));
  const smPerDiem = travelDays * PER_DIEM_CONUS;
  const depPerDiem = dependents * travelDays * PER_DIEM_CONUS * DEPENDENT_PER_DIEM_FACTOR;
  return Math.round((smPerDiem + depPerDiem) * 100) / 100;
}

/**
 * Temporary Lodging Expense — capped at 10 days.
 * Rate varies slightly by grade tier in practice; simplified to two tiers.
 */
export function calculateTle(tleDays: number, payGrade: PayGrade): number {
  const days = Math.min(Math.max(0, tleDays), MAX_TLE_DAYS);
  const isJunior =
    payGrade === 'E1' || payGrade === 'E2' || payGrade === 'E3' ||
    payGrade === 'E4' || payGrade === 'E5';
  const dailyRate = isJunior ? TLE_DAILY_MAX_E5_BELOW : TLE_DAILY_MAX_E6_ABOVE;
  return days * dailyRate;
}

/**
 * DITY/PPM incentive — 95% of estimated government shipping cost.
 * Only applicable to 'dity' and 'partial_dity' move types.
 */
export function calculateDityIncentive(estimatedWeight: number): number {
  if (estimatedWeight <= 0) return 0;
  return Math.round(estimatedWeight * GOV_COST_PER_LB * DITY_INCENTIVE_PCT * 100) / 100;
}

/**
 * Storage in Transit (SIT) cost estimate — government-covered, capped at 6 months.
 */
export function calculateStorageCost(estimatedWeight: number, storageMonths: number): number {
  if (estimatedWeight <= 0 || storageMonths <= 0) return 0;
  const months = Math.min(storageMonths, MAX_SIT_MONTHS);
  return Math.round(estimatedWeight * STORAGE_COST_PER_LB * months * 100) / 100;
}

// ────────────────────────────────────────────────────────────
// Out-of-Pocket Estimate (heuristics)
// ────────────────────────────────────────────────────────────

/**
 * Heuristic estimates for common out-of-pocket expenses above allowances.
 * Based on distance and family size. These are conservative averages.
 */
export function estimateOopCosts(
  distanceMiles: number,
  dependents: number,
): PcsOopEstimate {
  const isLong = distanceMiles > 1000;
  const familyMultiplier = 1 + dependents * 0.3;

  const temporaryHousing = Math.round((isLong ? 1200 : 600) * familyMultiplier);
  const travelMeals = Math.round((isLong ? 400 : 150) * familyMultiplier);
  const securityDeposits = Math.round((isLong ? 2500 : 1800) * familyMultiplier);
  const utilitySetup = Math.round(300 * familyMultiplier);
  const vehicleShipping = 0; // CONUS only; OCONUS would add $1,000–$5,000
  const miscellaneous = Math.round((isLong ? 500 : 300) * familyMultiplier);

  const total =
    temporaryHousing + travelMeals + securityDeposits +
    utilitySetup + vehicleShipping + miscellaneous;

  return {
    temporaryHousing,
    travelMeals,
    securityDeposits,
    utilitySetup,
    vehicleShipping,
    miscellaneous,
    total,
  };
}

// ────────────────────────────────────────────────────────────
// BAH Delta
// ────────────────────────────────────────────────────────────

function buildBahDelta(currentBah: number, newBah: number): PcsBahDelta {
  const monthlyDelta = newBah - currentBah;
  return {
    currentBah,
    newBah,
    monthlyDelta,
    annualImpact: monthlyDelta * 12,
  };
}

// ────────────────────────────────────────────────────────────
// Recommendation Builder
// ────────────────────────────────────────────────────────────

function buildRecommendation(
  input: PcsInput,
  allowances: PcsAllowances,
  oopEstimate: PcsOopEstimate,
  bahDelta: PcsBahDelta,
): string {
  const parts: string[] = [];

  // DITY vs TMO advice
  if (input.moveType === 'dity' && allowances.dityIncentive > 0) {
    const profit = allowances.dityIncentive - oopEstimate.total * 0.3;
    if (profit > 500) {
      parts.push(
        `Your DITY/PPM move could net ~$${Math.round(allowances.dityIncentive).toLocaleString()} ` +
        `in incentive pay. Consider getting multiple moving quotes to maximize savings.`,
      );
    } else {
      parts.push(
        `DITY incentive (~$${Math.round(allowances.dityIncentive).toLocaleString()}) ` +
        `may not significantly offset move costs. Consider TMO for lower stress.`,
      );
    }
  } else if (input.moveType === 'tmo') {
    parts.push(
      'TMO moves reduce out-of-pocket risk. Government covers shipping; ' +
      'focus your budget on temporary housing and travel costs.',
    );
  }

  // BAH delta warning
  if (bahDelta.monthlyDelta < -200) {
    parts.push(
      `BAH drops $${Math.abs(bahDelta.monthlyDelta)}/mo at new location — ` +
      `budget for $${Math.abs(bahDelta.annualImpact).toLocaleString()} annual reduction.`,
    );
  } else if (bahDelta.monthlyDelta > 200) {
    parts.push(
      `BAH increases $${bahDelta.monthlyDelta}/mo — ` +
      `consider directing the extra $${bahDelta.annualImpact.toLocaleString()}/yr to savings.`,
    );
  }

  // Emergency fund reminder
  if (oopEstimate.total > 3000) {
    parts.push(
      `Estimated out-of-pocket costs are $${oopEstimate.total.toLocaleString()}. ` +
      `Start setting aside funds at least 90 days before your move date.`,
    );
  }

  return parts.length > 0
    ? parts.join(' ')
    : 'Review your allowance breakdown and plan your move budget accordingly.';
}

// ────────────────────────────────────────────────────────────
// Main Orchestrator
// ────────────────────────────────────────────────────────────

/**
 * Calculate full PCS cost breakdown.
 *
 * @param input - Move parameters (distance, weight, grade, etc.)
 * @param currentBah - Current station BAH (looked up by UI layer)
 * @param newBah - New station BAH (looked up by UI layer)
 */
export function calculatePcsCosts(
  input: PcsInput,
  currentBah: number,
  newBah: number,
): PcsCostBreakdown {
  const isDity = input.moveType === 'dity' || input.moveType === 'partial_dity';

  const allowances: PcsAllowances = {
    dla: calculateDla(input.payGrade, input.dependents),
    mileage: calculateMileage(input.distanceMiles, input.dependents),
    perDiem: calculatePerDiem(input.distanceMiles, input.dependents),
    tle: calculateTle(input.tleDays, input.payGrade),
    dityIncentive: isDity ? calculateDityIncentive(input.estimatedWeight) : 0,
    storageCost: calculateStorageCost(input.estimatedWeight, input.storageMonths),
  };

  const bahDelta = buildBahDelta(currentBah, newBah);
  const oopEstimate = estimateOopCosts(input.distanceMiles, input.dependents);

  const totalAllowances =
    allowances.dla + allowances.mileage + allowances.perDiem +
    allowances.tle + allowances.dityIncentive + allowances.storageCost;

  const netCost = oopEstimate.total - (isDity ? allowances.dityIncentive : 0);

  const recommendation = buildRecommendation(input, allowances, oopEstimate, bahDelta);

  return {
    allowances,
    bahDelta,
    oopEstimate,
    netCost,
    totalAllowances,
    recommendation,
  };
}
