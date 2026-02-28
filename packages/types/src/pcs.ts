/**
 * PCS (Permanent Change of Station) calculator types.
 * Models inputs, allowances, BAH delta, OOP estimates, and full cost breakdown
 * for military relocation planning.
 */

import type { PayGrade } from './financial-state';

// ────────────────────────────────────────────────────────────
// Inputs
// ────────────────────────────────────────────────────────────

export interface PcsInput {
  currentZip: string;
  newZip: string;
  payGrade: PayGrade;
  dependents: number;
  moveDate: string;              // ISO date
  distanceMiles: number;         // User-provided or estimated
  estimatedWeight: number;       // Household goods weight in lbs
  moveType: 'dity' | 'tmo' | 'partial_dity';
  storageMonths: number;         // 0–6 months SIT
  tleDays: number;               // Temporary lodging days (max 10)
}

// ────────────────────────────────────────────────────────────
// Allowances
// ────────────────────────────────────────────────────────────

export interface PcsAllowances {
  dla: number;                   // Dislocation Allowance
  mileage: number;               // POV mileage reimbursement
  perDiem: number;               // Per diem for travel days
  tle: number;                   // Temporary Lodging Expense
  dityIncentive: number;         // 95% of gov't cost estimate (DITY/PPM)
  storageCost: number;           // Government-covered SIT
}

// ────────────────────────────────────────────────────────────
// BAH Delta
// ────────────────────────────────────────────────────────────

export interface PcsBahDelta {
  currentBah: number;
  newBah: number;
  monthlyDelta: number;          // newBah - currentBah
  annualImpact: number;          // monthlyDelta × 12
}

// ────────────────────────────────────────────────────────────
// Out-of-Pocket Estimate
// ────────────────────────────────────────────────────────────

export interface PcsOopEstimate {
  temporaryHousing: number;      // Above TLE allowance
  travelMeals: number;           // Above per diem
  securityDeposits: number;      // New housing deposit
  utilitySetup: number;          // New utility connections
  vehicleShipping: number;       // If applicable (OCONUS)
  miscellaneous: number;         // Tips, cleaning, supplies
  total: number;
}

// ────────────────────────────────────────────────────────────
// Full Cost Breakdown
// ────────────────────────────────────────────────────────────

export interface PcsCostBreakdown {
  allowances: PcsAllowances;
  bahDelta: PcsBahDelta;
  oopEstimate: PcsOopEstimate;
  netCost: number;               // OOP total - (DITY incentive if applicable)
  totalAllowances: number;       // Sum of all allowances
  recommendation: string;        // Human-readable advice
}
