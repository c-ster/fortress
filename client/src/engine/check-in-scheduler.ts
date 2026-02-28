/**
 * Behavioral check-in scheduler and question engine.
 *
 * Pure functions — no React, no side effects.
 *
 * Key rules (README §6.9):
 *   - Check-ins on 2nd and 16th (day after military paydays on 1st and 15th)
 *   - Two-question maximum per check-in
 *   - Progress trajectory visualization
 *   - No badges, no points, no leaderboards
 */

import type {
  FinancialState,
  CheckIn,
  CheckInQuestion,
  CheckInCategory,
  TrajectoryEstimate,
} from '@fortress/types';
import { formatCurrencyWhole } from '../utils/format-currency';

// --- Constants ---

/** Check-in days within each month (day after 1st and 15th paydays). */
const CHECK_IN_DAYS = [2, 16] as const;

const MAX_QUESTIONS = 2;

// --- Question Bank ---

export const QUESTION_BANK: CheckInQuestion[] = [
  // Emergency fund
  {
    id: 'q_ef_allotment',
    category: 'emergency_fund',
    text: 'Did you set up or maintain your savings allotment this pay period?',
    responseType: 'yes_no',
  },
  {
    id: 'q_ef_amount',
    category: 'emergency_fund',
    text: 'How much did you add to your emergency fund this pay period?',
    responseType: 'dollar_amount',
  },
  // Debt
  {
    id: 'q_debt_extra',
    category: 'debt',
    text: 'Did you make any extra payments toward your highest-interest debt?',
    responseType: 'yes_no',
  },
  {
    id: 'q_debt_amount',
    category: 'debt',
    text: 'How much extra did you put toward debt payoff this pay period?',
    responseType: 'dollar_amount',
  },
  // TSP
  {
    id: 'q_tsp_increase',
    category: 'tsp',
    text: 'Have you increased your TSP contribution since your last check-in?',
    responseType: 'yes_no',
  },
  {
    id: 'q_tsp_review',
    category: 'tsp',
    text: 'Did you review your TSP fund allocation this month?',
    responseType: 'yes_no',
  },
  // Spending
  {
    id: 'q_spend_track',
    category: 'spending',
    text: 'Did you track your discretionary spending this pay period?',
    responseType: 'yes_no',
  },
  {
    id: 'q_spend_confidence',
    category: 'spending',
    text: 'How confident do you feel about your spending this pay period?',
    responseType: 'scale',
    scaleLabels: ['Not confident', 'Very confident'],
  },
  // General
  {
    id: 'q_gen_stress',
    category: 'general',
    text: 'How would you rate your financial stress level right now?',
    responseType: 'scale',
    scaleLabels: ['Very stressed', 'No stress'],
  },
  {
    id: 'q_gen_progress',
    category: 'general',
    text: 'Do you feel you made financial progress since your last check-in?',
    responseType: 'yes_no',
  },
];

// --- Scheduling ---

/**
 * Format a Date as YYYY-MM-DD.
 */
function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Return the next check-in date (2nd or 16th) on or after `from`.
 * Returns YYYY-MM-DD string.
 */
export function getNextCheckInDate(from: Date = new Date()): string {
  const day = from.getDate();
  const month = from.getMonth();
  const year = from.getFullYear();

  if (day <= 2) {
    return toDateString(new Date(year, month, 2));
  }
  if (day <= 16) {
    return toDateString(new Date(year, month, 16));
  }
  // Next month's 2nd
  return toDateString(new Date(year, month + 1, 2));
}

/**
 * Check whether a check-in is due today.
 * True when today is the 2nd or 16th AND no completed/skipped check-in exists for today.
 */
export function isCheckInDue(checkIns: CheckIn[], today: Date = new Date()): boolean {
  const day = today.getDate();
  if (!CHECK_IN_DAYS.includes(day as 2 | 16)) return false;

  const todayStr = toDateString(today);
  const existing = checkIns.find((c) => c.scheduledDate === todayStr);
  return !existing || existing.status === 'pending';
}

/**
 * Get the pending check-in for today, creating one if due and not yet in the array.
 * Returns null if no check-in is due today.
 */
export function getPendingCheckIn(checkIns: CheckIn[], today: Date = new Date()): CheckIn | null {
  const day = today.getDate();
  if (!CHECK_IN_DAYS.includes(day as 2 | 16)) return null;

  const todayStr = toDateString(today);
  const existing = checkIns.find((c) => c.scheduledDate === todayStr);

  if (existing) {
    return existing.status === 'pending' ? existing : null;
  }

  // Create new pending check-in
  return {
    id: `checkin_${todayStr}`,
    scheduledDate: todayStr,
    status: 'pending',
    responses: [],
  };
}

// --- Question Selection ---

/**
 * Priority order for risk categories based on the user's current financial state.
 * Returns categories sorted by urgency (worst first).
 */
function rankCategories(state: FinancialState): CheckInCategory[] {
  const scores: { category: CheckInCategory; urgency: number }[] = [
    {
      category: 'emergency_fund',
      urgency: state.risk.emergencyFundMonths < 3 ? 3 - state.risk.emergencyFundMonths : 0,
    },
    {
      category: 'debt',
      urgency: state.risk.highInterestDebtTotal > 0
        ? Math.min(state.risk.debtToIncomeRatio * 10, 3)
        : 0,
    },
    {
      category: 'tsp',
      urgency: state.risk.tspMatchCaptured ? 0 : 2,
    },
    {
      category: 'spending',
      urgency: state.risk.paydaySpikeSeverity > 0 ? state.risk.paydaySpikeSeverity : 0.5,
    },
    {
      category: 'general',
      urgency: 0.1, // always lowest priority but included as fallback
    },
  ];

  return scores
    .sort((a, b) => b.urgency - a.urgency)
    .map((s) => s.category);
}

/**
 * Select check-in questions targeted at the user's weakest financial areas.
 * Returns at most `count` questions (default 2).
 */
export function selectQuestions(
  state: FinancialState,
  count: number = MAX_QUESTIONS,
): CheckInQuestion[] {
  const rankedCategories = rankCategories(state);
  const selected: CheckInQuestion[] = [];
  const usedCategories = new Set<CheckInCategory>();

  // Pick one question per category, in priority order
  for (const category of rankedCategories) {
    if (selected.length >= count) break;
    if (usedCategories.has(category)) continue;

    const candidates = QUESTION_BANK.filter((q) => q.category === category);
    if (candidates.length === 0) continue;

    // Rotate questions: use check-in count as a simple index
    const idx = state.checkIns.length % candidates.length;
    selected.push(candidates[idx]);
    usedCategories.add(category);
  }

  return selected;
}

// --- Trajectory ---

/**
 * Format a future date as "Month YYYY" string.
 */
function formatTargetMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Estimate monthly savings rate from dollar_amount check-in responses.
 * Averages all emergency_fund dollar responses, doubled (since check-ins are bimonthly).
 */
function estimateMonthlyRateFromCheckIns(
  checkIns: CheckIn[],
  questionCategory: CheckInCategory,
): number | null {
  const amounts: number[] = [];

  for (const ci of checkIns) {
    if (ci.status !== 'completed') continue;
    for (const resp of ci.responses) {
      const question = QUESTION_BANK.find((q) => q.id === resp.questionId);
      if (question?.category === questionCategory && question.responseType === 'dollar_amount') {
        amounts.push(resp.value);
      }
    }
  }

  if (amounts.length === 0) return null;

  // Average per check-in × 2 (bimonthly → monthly)
  const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
  return avg * 2;
}

/**
 * Calculate trajectory estimates for key financial metrics.
 * Uses check-in history for rate estimation, falling back to FSM-derived estimates.
 */
export function calculateTrajectory(
  state: FinancialState,
  checkIns: CheckIn[],
): TrajectoryEstimate[] {
  const estimates: TrajectoryEstimate[] = [];
  const now = new Date();

  // 1. Emergency fund trajectory
  const efCurrent = state.assets.totalLiquid;
  const efTarget = state.expenses.totalEssential * 3; // 3-month target
  if (efTarget > 0 && efCurrent < efTarget) {
    const ciRate = estimateMonthlyRateFromCheckIns(checkIns, 'emergency_fund');
    // Fallback: assume allotments as the monthly savings rate
    const allotmentTotal = state.deductions.allotments
      .filter((a) => a.destination === 'savings')
      .reduce((s, a) => s + a.amount, 0);
    const monthlyRate = ciRate ?? allotmentTotal;

    let targetDate = '';
    let message: string;

    if (monthlyRate > 0) {
      const monthsToTarget = Math.ceil((efTarget - efCurrent) / monthlyRate);
      const target = new Date(now);
      target.setMonth(target.getMonth() + monthsToTarget);
      targetDate = toDateString(target);
      message =
        `Your emergency fund is at ${formatCurrencyWhole(efCurrent)}. ` +
        `At current rate, you hit ${formatCurrencyWhole(efTarget)} by ${formatTargetMonth(target)}.`;
    } else {
      message =
        `Your emergency fund is at ${formatCurrencyWhole(efCurrent)}. ` +
        `Set up a savings allotment to start building toward ${formatCurrencyWhole(efTarget)}.`;
    }

    estimates.push({
      metric: 'emergencyFund',
      currentValue: efCurrent,
      targetValue: efTarget,
      monthlyRate,
      targetDate,
      message,
    });
  }

  // 2. Debt payoff trajectory
  const totalDebt = state.debts.reduce((s, d) => s + d.balance, 0);
  if (totalDebt > 0) {
    const totalPayments = state.debts.reduce((s, d) => s + d.monthlyPayment, 0);
    const ciRate = estimateMonthlyRateFromCheckIns(checkIns, 'debt');
    const monthlyRate = totalPayments + (ciRate ?? 0);

    let targetDate = '';
    let message: string;

    if (monthlyRate > 0) {
      const monthsToPayoff = Math.ceil(totalDebt / monthlyRate);
      const target = new Date(now);
      target.setMonth(target.getMonth() + monthsToPayoff);
      targetDate = toDateString(target);
      message =
        `Your total debt is ${formatCurrencyWhole(totalDebt)}. ` +
        `At current rate, you're debt-free by ${formatTargetMonth(target)}.`;
    } else {
      message =
        `Your total debt is ${formatCurrencyWhole(totalDebt)}. ` +
        'Review your debt strategy to start making progress.';
    }

    estimates.push({
      metric: 'totalDebt',
      currentValue: totalDebt,
      targetValue: 0,
      monthlyRate,
      targetDate,
      message,
    });
  }

  // 3. TSP trajectory
  const tspCurrent = state.assets.tspBalance;
  const monthlyTsp = state.deductions.tspTraditional + state.deductions.tspRoth;
  if (monthlyTsp > 0) {
    // Project 20-year balance with 7% annual return
    const monthlyReturn = 0.07 / 12;
    const months = 240; // 20 years
    // Future value of annuity + current balance growth
    const fvAnnuity = monthlyTsp * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);
    const fvCurrent = tspCurrent * Math.pow(1 + monthlyReturn, months);
    const projected = Math.round(fvCurrent + fvAnnuity);

    const target = new Date(now);
    target.setFullYear(target.getFullYear() + 20);

    estimates.push({
      metric: 'tspBalance',
      currentValue: tspCurrent,
      targetValue: projected,
      monthlyRate: monthlyTsp,
      targetDate: toDateString(target),
      message:
        `Your TSP balance is ${formatCurrencyWhole(tspCurrent)} with ` +
        `${formatCurrencyWhole(monthlyTsp)}/month contributions. ` +
        `Projected to reach ${formatCurrencyWhole(projected)} in 20 years.`,
    });
  }

  return estimates;
}

// --- History ---

/**
 * Return completed check-ins sorted most-recent first.
 * Optionally limited to `limit` entries.
 */
export function getCheckInHistory(checkIns: CheckIn[], limit?: number): CheckIn[] {
  const completed = checkIns
    .filter((c) => c.status === 'completed')
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));

  return limit != null ? completed.slice(0, limit) : completed;
}
