/**
 * Debt payment strategies for the financial simulator.
 *
 * Pure function: no side effects, no DOM, no Zustand.
 * Returns new arrays (immutable) — never mutates input.
 *
 * Strategies:
 *   - minimum: pay only minimum payments
 *   - avalanche: extra payment targets highest APR first
 *   - snowball: extra payment targets lowest balance first
 */

/** Simplified debt for simulation (stripped from full Debt type). */
export interface SimDebt {
  balance: number;
  apr: number;
  minimumPayment: number;
}

/**
 * Apply one month of debt payments using the specified strategy.
 *
 * @param debts Current debt balances
 * @param strategy Payment allocation strategy
 * @param extraPayment Additional monthly payment beyond minimums
 * @returns New debt array with updated balances + total amount paid this month
 */
export function applyDebtPayment(
  debts: SimDebt[],
  strategy: 'minimum' | 'avalanche' | 'snowball',
  extraPayment: number,
): { debts: SimDebt[]; totalPaid: number } {
  if (debts.length === 0) return { debts: [], totalPaid: 0 };

  // 1. Accrue interest and apply minimum payments
  let totalPaid = 0;
  const updated = debts.map((d) => {
    if (d.balance <= 0) return { ...d, balance: 0 };

    // Accrue monthly interest
    const withInterest = d.balance * (1 + d.apr / 100 / 12);

    // Apply minimum payment (capped at balance)
    const minPay = Math.min(d.minimumPayment, withInterest);
    totalPaid += minPay;

    return { ...d, balance: Math.max(0, withInterest - minPay) };
  });

  // 2. Apply extra payment per strategy
  if (extraPayment > 0 && strategy !== 'minimum') {
    const sorted = updated
      .map((d, i) => ({ index: i, ...d }))
      .filter((d) => d.balance > 0);

    if (strategy === 'avalanche') {
      sorted.sort((a, b) => b.apr - a.apr);
    } else {
      sorted.sort((a, b) => a.balance - b.balance);
    }

    let remaining = extraPayment;
    for (const target of sorted) {
      if (remaining <= 0) break;
      const payment = Math.min(remaining, updated[target.index].balance);
      updated[target.index] = {
        ...updated[target.index],
        balance: Math.max(0, updated[target.index].balance - payment),
      };
      totalPaid += payment;
      remaining -= payment;
    }
  }

  return { debts: updated, totalPaid };
}
