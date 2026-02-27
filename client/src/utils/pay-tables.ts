import type { PayGrade } from '@fortress/types';

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

interface BahEntry {
  installation: string;
  with: number;
  without: number;
}

interface BahTable {
  meta: Record<string, unknown>;
  [zip: string]: BahEntry | Record<string, unknown>;
}

// --- Lazy-loaded cache ---

let basePayData: BasePayTable | null = null;
let basData: BasTable | null = null;
let bahData: BahTable | null = null;

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
 * Returns null if the ZIP is not in the stub table.
 * Note: Stub uses E5 baseline rates only.
 */
export async function lookupBah(
  zip: string,
  hasDependents: boolean,
): Promise<{ amount: number; installation: string } | null> {
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
