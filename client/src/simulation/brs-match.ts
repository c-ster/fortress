/**
 * BRS (Blended Retirement System) government match calculator.
 *
 * Pure function: no side effects, no DOM, no Zustand.
 *
 * BRS match formula (per DoD policy):
 *   - 1% automatic: government contributes 1% of base pay regardless
 *   - Dollar-for-dollar on first 3% of employee contribution
 *   - 50 cents per dollar on next 2% (employee contributes 3%–5%)
 *   - Match caps at 5% employee contribution
 *
 * At 5% employee contribution on $3,000 basePay:
 *   auto = $30, tier1 = $90, tier2 = $30 × 0.5 = $15 → total = $135
 */

/**
 * Calculate monthly BRS government match amount.
 *
 * @param employeePct Employee TSP contribution as a decimal (0.05 = 5%)
 * @param basePay Monthly base pay in dollars
 * @returns Monthly government match contribution in dollars
 */
export function calculateBRSMatch(employeePct: number, basePay: number): number {
  if (basePay <= 0) return 0;

  const pct = Math.max(0, employeePct);

  // 1% automatic contribution (always)
  const auto = 0.01 * basePay;

  // Dollar-for-dollar on first 3%
  const tier1 = Math.min(pct, 0.03) * basePay;

  // 50 cents per dollar on next 2% (3%–5%)
  const tier2 = Math.max(0, Math.min(pct, 0.05) - 0.03) * basePay * 0.5;

  return auto + tier1 + tier2;
}
