import type { PayGrade } from '@fortress/types';
import { config } from '../config';

// --- Types for JSON data ---

interface BasePayTable {
  meta: Record<string, unknown>;
  [grade: string]: Record<string, number> | Record<string, unknown>;
}

interface BasTable {
  meta: Record<string, unknown>;
  enlisted: number;
  officer: number;
}

export interface BahEntry {
  installation: string;
  with: number;
  without: number;
}

export interface BahTable {
  meta: Record<string, unknown>;
  [zip: string]: BahEntry | Record<string, unknown>;
}

// --- Lazy-loaded cache ---

let basePayData: BasePayTable | null = null;
let basData: BasTable | null = null;
let bahData: BahTable | null = null;

/** Full BAH table fetched from the server (or IndexedDB). */
let bahFullTable: BahTable | null = null;

async function loadBasePay(): Promise<BasePayTable> {
  if (!basePayData) {
    const mod = await import('@pay-tables/base-pay-2025.json');
    basePayData = mod.default as BasePayTable;
  }
  return basePayData;
}

async function loadBas(): Promise<BasTable> {
  if (!basData) {
    const mod = await import('@pay-tables/bas-2025.json');
    basData = mod.default as BasTable;
  }
  return basData;
}

async function loadBah(): Promise<BahTable> {
  if (!bahData) {
    const mod = await import('@pay-tables/bah-2025-stub.json');
    bahData = mod.default as BahTable;
  }
  return bahData;
}

// --- Full BAH table helpers ---

/**
 * Inject the full BAH table (from server or IndexedDB cache).
 * Once set, lookupBah will check this table first before falling back to the stub.
 */
export function setBahFullTable(table: BahTable): void {
  bahFullTable = table;
}

/** Check whether the full BAH table has been loaded. */
export function isBahFullTableLoaded(): boolean {
  return bahFullTable !== null;
}

/**
 * Fetch the BAH version info from the server.
 * Returns the hash and year for cache comparison.
 */
export async function fetchBahVersion(): Promise<{ hash: string; year: number }> {
  const response = await fetch(`${config.apiUrl}/tables/version`);
  if (!response.ok) {
    throw new Error(`Failed to fetch BAH version: ${response.status}`);
  }
  const data = (await response.json()) as { bah?: { hash: string; year: number } };
  if (!data.bah) {
    throw new Error('BAH version info not available');
  }
  return data.bah;
}

/**
 * Fetch the full BAH table from the server.
 */
export async function fetchBahTable(year = 2025): Promise<BahTable> {
  const response = await fetch(`${config.apiUrl}/tables/bah/${year}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch BAH table: ${response.status}`);
  }
  return response.json() as Promise<BahTable>;
}

// --- Lookups ---

/**
 * Look up monthly base pay for a pay grade and years of service.
 * Uses the highest YOS bracket <= the given YOS (how military pay tables work).
 */
export async function lookupBasePay(
  grade: PayGrade,
  yearsOfService: number,
): Promise<number | null> {
  const table = await loadBasePay();
  const gradeTable = table[grade];
  if (!gradeTable || typeof gradeTable !== 'object' || 'year' in gradeTable) return null;

  const yosKeys = Object.keys(gradeTable)
    .map(Number)
    .filter((k) => !isNaN(k))
    .sort((a, b) => a - b);

  let matched: number | null = null;
  for (const key of yosKeys) {
    if (key <= yearsOfService) matched = key;
  }

  if (matched === null) return null;
  return (gradeTable as Record<string, number>)[String(matched)] ?? null;
}

/**
 * Look up BAS. Enlisted (E1-E9) get enlisted rate, officers/warrant get officer rate.
 */
export async function lookupBas(grade: PayGrade): Promise<number> {
  const table = await loadBas();
  return grade.startsWith('E') ? table.enlisted : table.officer;
}

/**
 * Look up BAH by ZIP code and dependent status.
 * Checks the full server-fetched table first, then falls back to the bundled stub.
 * Note: Uses E5 baseline rates.
 */
export async function lookupBah(
  zip: string,
  hasDependents: boolean,
): Promise<{ amount: number; installation: string } | null> {
  // 1. Check full table first (from server / IndexedDB)
  if (bahFullTable) {
    const fullEntry = bahFullTable[zip];
    if (fullEntry && typeof fullEntry === 'object' && 'with' in fullEntry) {
      const bahEntry = fullEntry as BahEntry;
      return {
        amount: hasDependents ? bahEntry.with : bahEntry.without,
        installation: bahEntry.installation,
      };
    }
  }

  // 2. Fall back to bundled stub
  const table = await loadBah();
  const entry = table[zip];
  if (!entry || typeof entry !== 'object' || !('with' in entry)) return null;

  const bahEntry = entry as BahEntry;
  return {
    amount: hasDependents ? bahEntry.with : bahEntry.without,
    installation: bahEntry.installation,
  };
}

/**
 * Look up all pay components at once. Convenience wrapper.
 */
export async function lookupAllPay(
  grade: PayGrade,
  yearsOfService: number,
  zip: string,
  dependents: number,
): Promise<{
  basePay: number | null;
  bas: number;
  bah: number | null;
  bahInstallation: string | null;
}> {
  const [basePay, bas, bahResult] = await Promise.all([
    lookupBasePay(grade, yearsOfService),
    lookupBas(grade),
    lookupBah(zip, dependents > 0),
  ]);

  return {
    basePay,
    bas,
    bah: bahResult?.amount ?? null,
    bahInstallation: bahResult?.installation ?? null,
  };
}
