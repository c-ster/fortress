import { describe, it, expect } from 'vitest';
import type { FinancialState, CheckIn } from '@fortress/types';
import {
  getNextCheckInDate,
  isCheckInDue,
  getPendingCheckIn,
  selectQuestions,
  calculateTrajectory,
  getCheckInHistory,
  QUESTION_BANK,
} from '../../src/engine/check-in-scheduler';

// --- Helpers ---

/** Minimal FinancialState factory for testing. */
function makeState(overrides: Partial<{
  emergencyFundMonths: number;
  debtToIncomeRatio: number;
  highInterestDebtTotal: number;
  tspMatchCaptured: boolean;
  paydaySpikeSeverity: number;
  totalLiquid: number;
  totalEssential: number;
  totalDebt: number;
  tspBalance: number;
  tspTraditional: number;
  tspRoth: number;
  allotmentSavings: number;
  checkIns: CheckIn[];
}> = {}): FinancialState {
  return {
    income: {
      basePay: 3000, bah: 1200, bas: 400, cola: 0, specialPay: 0, otherIncome: 0,
      totalGross: 4600, totalTaxable: 3000, totalNonTaxable: 1600,
    },
    deductions: {
      federalTax: 300, stateTax: 100, fica: 230, sgli: 25, sgliCoverage: 500000,
      tspTraditional: overrides.tspTraditional ?? 150, tspRoth: overrides.tspRoth ?? 0,
      tspContributionPct: 0.05,
      tricare: 0, otherDeductions: 0,
      allotments: overrides.allotmentSavings != null
        ? [{ id: 'a1', name: 'Savings', amount: overrides.allotmentSavings, destination: 'savings' as const }]
        : [],
    },
    expenses: {
      housing: 0, utilities: 150, transportation: 300, food: 400,
      childcare: 0, insurance: 0, subscriptions: 50, discretionary: 200,
      totalEssential: overrides.totalEssential ?? 850,
      totalMonthly: 1100,
    },
    debts: overrides.totalDebt != null && overrides.totalDebt > 0
      ? [{
        id: 'd1', name: 'Credit Card', type: 'credit_card',
        balance: overrides.totalDebt, apr: 18, minimumPayment: 50,
        monthlyPayment: 100, preService: false,
      }]
      : [],
    assets: {
      checkingBalance: 500,
      savingsBalance: (overrides.totalLiquid ?? 1000) - 500,
      emergencyFund: 0,
      tspBalance: overrides.tspBalance ?? 5000,
      otherInvestments: 0,
      totalLiquid: overrides.totalLiquid ?? 1000,
    },
    military: {
      payGrade: 'E5', yearsOfService: 4, dependents: 1,
      dutyStation: 'Fort Liberty', component: 'active',
      retirementSystem: 'brs', scraEligible: false,
    },
    risk: {
      emergencyFundMonths: overrides.emergencyFundMonths ?? 1.2,
      debtToIncomeRatio: overrides.debtToIncomeRatio ?? 0.15,
      highInterestDebtTotal: overrides.highInterestDebtTotal ?? 3000,
      sgliAdequate: true,
      tspMatchCaptured: overrides.tspMatchCaptured ?? true,
      scraOpportunity: 0,
      paydaySpikeSeverity: overrides.paydaySpikeSeverity ?? 0,
    },
    meta: {
      dataSource: 'manual', lastUpdated: new Date().toISOString(),
      completeness: 0.8, confidenceScores: {},
    },
    actionStatuses: {},
    checkIns: overrides.checkIns ?? [],
  };
}

function makeCheckIn(date: string, status: CheckIn['status'] = 'completed'): CheckIn {
  return {
    id: `checkin_${date}`,
    scheduledDate: date,
    status,
    responses: [],
    ...(status === 'completed' ? { completedAt: `${date}T12:00:00Z` } : {}),
  };
}

// ============================================================
// getNextCheckInDate
// ============================================================

describe('getNextCheckInDate', () => {
  it('returns 2nd when called on Jan 1', () => {
    const result = getNextCheckInDate(new Date(2026, 0, 1)); // Jan 1
    expect(result).toBe('2026-01-02');
  });

  it('returns 2nd when called on Jan 2', () => {
    const result = getNextCheckInDate(new Date(2026, 0, 2)); // Jan 2
    expect(result).toBe('2026-01-02');
  });

  it('returns 16th when called on Jan 3', () => {
    const result = getNextCheckInDate(new Date(2026, 0, 3)); // Jan 3
    expect(result).toBe('2026-01-16');
  });

  it('returns 16th when called on Jan 15', () => {
    const result = getNextCheckInDate(new Date(2026, 0, 15)); // Jan 15
    expect(result).toBe('2026-01-16');
  });

  it('returns 16th when called on Jan 16', () => {
    const result = getNextCheckInDate(new Date(2026, 0, 16)); // Jan 16
    expect(result).toBe('2026-01-16');
  });

  it('wraps to next month 2nd when called on Jan 17', () => {
    const result = getNextCheckInDate(new Date(2026, 0, 17)); // Jan 17
    expect(result).toBe('2026-02-02');
  });

  it('wraps from December to January', () => {
    const result = getNextCheckInDate(new Date(2025, 11, 20)); // Dec 20
    expect(result).toBe('2026-01-02');
  });
});

// ============================================================
// isCheckInDue
// ============================================================

describe('isCheckInDue', () => {
  it('returns true on 2nd with no existing check-ins', () => {
    expect(isCheckInDue([], new Date(2026, 0, 2))).toBe(true);
  });

  it('returns true on 16th with no existing check-ins', () => {
    expect(isCheckInDue([], new Date(2026, 0, 16))).toBe(true);
  });

  it('returns false on non-check-in day', () => {
    expect(isCheckInDue([], new Date(2026, 0, 5))).toBe(false);
    expect(isCheckInDue([], new Date(2026, 0, 1))).toBe(false);
    expect(isCheckInDue([], new Date(2026, 0, 15))).toBe(false);
  });

  it('returns false when check-in already completed for today', () => {
    const checkIns = [makeCheckIn('2026-01-02', 'completed')];
    expect(isCheckInDue(checkIns, new Date(2026, 0, 2))).toBe(false);
  });

  it('returns false when check-in skipped for today', () => {
    const checkIns = [makeCheckIn('2026-01-02', 'skipped')];
    expect(isCheckInDue(checkIns, new Date(2026, 0, 2))).toBe(false);
  });

  it('returns true when check-in is pending for today', () => {
    const checkIns = [makeCheckIn('2026-01-02', 'pending')];
    expect(isCheckInDue(checkIns, new Date(2026, 0, 2))).toBe(true);
  });
});

// ============================================================
// getPendingCheckIn
// ============================================================

describe('getPendingCheckIn', () => {
  it('returns null on non-check-in day', () => {
    expect(getPendingCheckIn([], new Date(2026, 0, 5))).toBeNull();
  });

  it('creates new pending check-in when due and none exists', () => {
    const result = getPendingCheckIn([], new Date(2026, 0, 2));
    expect(result).not.toBeNull();
    expect(result!.id).toBe('checkin_2026-01-02');
    expect(result!.scheduledDate).toBe('2026-01-02');
    expect(result!.status).toBe('pending');
    expect(result!.responses).toEqual([]);
  });

  it('returns existing pending check-in', () => {
    const pending = makeCheckIn('2026-01-16', 'pending');
    const result = getPendingCheckIn([pending], new Date(2026, 0, 16));
    expect(result).toBe(pending);
  });

  it('returns null when check-in already completed', () => {
    const completed = makeCheckIn('2026-01-02', 'completed');
    expect(getPendingCheckIn([completed], new Date(2026, 0, 2))).toBeNull();
  });
});

// ============================================================
// selectQuestions
// ============================================================

describe('selectQuestions', () => {
  it('returns max 2 questions by default', () => {
    const state = makeState();
    const questions = selectQuestions(state);
    expect(questions.length).toBeLessThanOrEqual(2);
    expect(questions.length).toBeGreaterThan(0);
  });

  it('respects custom count parameter', () => {
    const state = makeState();
    const questions = selectQuestions(state, 1);
    expect(questions).toHaveLength(1);
  });

  it('targets emergency fund when it is the weakest area', () => {
    const state = makeState({
      emergencyFundMonths: 0.5, // very low
      highInterestDebtTotal: 0,
      debtToIncomeRatio: 0,
      tspMatchCaptured: true,
    });
    const questions = selectQuestions(state);
    expect(questions[0].category).toBe('emergency_fund');
  });

  it('targets debt when DTI is high and emergency fund is OK', () => {
    const state = makeState({
      emergencyFundMonths: 4, // above 3-month target
      debtToIncomeRatio: 0.45,
      highInterestDebtTotal: 10000,
      tspMatchCaptured: true,
    });
    const questions = selectQuestions(state);
    expect(questions[0].category).toBe('debt');
  });

  it('targets TSP when match is not captured', () => {
    const state = makeState({
      emergencyFundMonths: 4,
      debtToIncomeRatio: 0,
      highInterestDebtTotal: 0,
      tspMatchCaptured: false,
    });
    const questions = selectQuestions(state);
    expect(questions.some((q) => q.category === 'tsp')).toBe(true);
  });

  it('selects from different categories', () => {
    const state = makeState();
    const questions = selectQuestions(state, 2);
    if (questions.length === 2) {
      expect(questions[0].category).not.toBe(questions[1].category);
    }
  });

  it('all returned questions exist in QUESTION_BANK', () => {
    const state = makeState();
    const questions = selectQuestions(state, 2);
    for (const q of questions) {
      expect(QUESTION_BANK.find((bq) => bq.id === q.id)).toBeDefined();
    }
  });
});

// ============================================================
// calculateTrajectory
// ============================================================

describe('calculateTrajectory', () => {
  it('produces emergency fund trajectory when below 3 months', () => {
    const state = makeState({
      totalLiquid: 900,
      totalEssential: 850,
      emergencyFundMonths: 900 / 850,
      allotmentSavings: 200,
    });
    const trajectories = calculateTrajectory(state, []);
    const ef = trajectories.find((t) => t.metric === 'emergencyFund');
    expect(ef).toBeDefined();
    expect(ef!.currentValue).toBe(900);
    expect(ef!.targetValue).toBe(2550); // 850 * 3
    expect(ef!.monthlyRate).toBe(200);
    expect(ef!.message).toContain('$900');
    expect(ef!.message).toContain('$2,550');
  });

  it('uses check-in history for rate estimation when available', () => {
    const checkIns: CheckIn[] = [
      {
        id: 'checkin_2026-01-02',
        scheduledDate: '2026-01-02',
        status: 'completed',
        completedAt: '2026-01-02T12:00:00Z',
        responses: [
          { questionId: 'q_ef_amount', value: 150, answeredAt: '2026-01-02T12:00:00Z' },
        ],
      },
      {
        id: 'checkin_2026-01-16',
        scheduledDate: '2026-01-16',
        status: 'completed',
        completedAt: '2026-01-16T12:00:00Z',
        responses: [
          { questionId: 'q_ef_amount', value: 250, answeredAt: '2026-01-16T12:00:00Z' },
        ],
      },
    ];
    const state = makeState({
      totalLiquid: 900,
      totalEssential: 850,
      emergencyFundMonths: 900 / 850,
      checkIns,
    });
    const trajectories = calculateTrajectory(state, checkIns);
    const ef = trajectories.find((t) => t.metric === 'emergencyFund');
    expect(ef).toBeDefined();
    // Average: (150+250)/2 = 200 per check-in, × 2 = 400/month
    expect(ef!.monthlyRate).toBe(400);
  });

  it('produces debt payoff trajectory when debts exist', () => {
    const state = makeState({ totalDebt: 5000 });
    const trajectories = calculateTrajectory(state, []);
    const debt = trajectories.find((t) => t.metric === 'totalDebt');
    expect(debt).toBeDefined();
    expect(debt!.currentValue).toBe(5000);
    expect(debt!.targetValue).toBe(0);
    expect(debt!.message).toContain('$5,000');
    expect(debt!.message).toContain('debt-free');
  });

  it('produces TSP trajectory when contributing', () => {
    const state = makeState({ tspBalance: 10000, tspTraditional: 150 });
    const trajectories = calculateTrajectory(state, []);
    const tsp = trajectories.find((t) => t.metric === 'tspBalance');
    expect(tsp).toBeDefined();
    expect(tsp!.currentValue).toBe(10000);
    expect(tsp!.monthlyRate).toBe(150);
    expect(tsp!.message).toContain('$10,000');
    expect(tsp!.message).toContain('20 years');
  });

  it('shows "set up allotment" message when monthly rate is 0', () => {
    const state = makeState({
      totalLiquid: 500,
      totalEssential: 850,
      emergencyFundMonths: 500 / 850,
      allotmentSavings: 0,
    });
    // Remove all allotments
    state.deductions.allotments = [];
    const trajectories = calculateTrajectory(state, []);
    const ef = trajectories.find((t) => t.metric === 'emergencyFund');
    expect(ef).toBeDefined();
    expect(ef!.monthlyRate).toBe(0);
    expect(ef!.message).toContain('allotment');
    expect(ef!.targetDate).toBe('');
  });

  it('returns empty array when all metrics are healthy', () => {
    const state = makeState({
      totalLiquid: 5000,
      totalEssential: 850,
      emergencyFundMonths: 5000 / 850, // >3 months
      totalDebt: 0,
      tspTraditional: 0,
      tspRoth: 0,
    });
    state.debts = [];
    const trajectories = calculateTrajectory(state, []);
    // No emergency fund trajectory (above 3 months), no debt, no TSP contributions
    expect(trajectories).toHaveLength(0);
  });
});

// ============================================================
// getCheckInHistory
// ============================================================

describe('getCheckInHistory', () => {
  it('returns completed check-ins in reverse date order', () => {
    const checkIns: CheckIn[] = [
      makeCheckIn('2026-01-02', 'completed'),
      makeCheckIn('2026-01-16', 'completed'),
      makeCheckIn('2026-02-02', 'pending'),
    ];
    const history = getCheckInHistory(checkIns);
    expect(history).toHaveLength(2);
    expect(history[0].scheduledDate).toBe('2026-01-16');
    expect(history[1].scheduledDate).toBe('2026-01-02');
  });

  it('respects limit parameter', () => {
    const checkIns: CheckIn[] = [
      makeCheckIn('2026-01-02', 'completed'),
      makeCheckIn('2026-01-16', 'completed'),
      makeCheckIn('2026-02-02', 'completed'),
    ];
    const history = getCheckInHistory(checkIns, 2);
    expect(history).toHaveLength(2);
  });

  it('filters out pending and skipped check-ins', () => {
    const checkIns: CheckIn[] = [
      makeCheckIn('2026-01-02', 'completed'),
      makeCheckIn('2026-01-16', 'skipped'),
      makeCheckIn('2026-02-02', 'pending'),
    ];
    const history = getCheckInHistory(checkIns);
    expect(history).toHaveLength(1);
    expect(history[0].scheduledDate).toBe('2026-01-02');
  });

  it('returns empty array when no completed check-ins', () => {
    expect(getCheckInHistory([])).toEqual([]);
    expect(getCheckInHistory([makeCheckIn('2026-01-02', 'pending')])).toEqual([]);
  });
});

// ============================================================
// QUESTION_BANK
// ============================================================

describe('QUESTION_BANK', () => {
  it('has at least 10 questions', () => {
    expect(QUESTION_BANK.length).toBeGreaterThanOrEqual(10);
  });

  it('covers all categories', () => {
    const categories = new Set(QUESTION_BANK.map((q) => q.category));
    expect(categories).toContain('emergency_fund');
    expect(categories).toContain('debt');
    expect(categories).toContain('tsp');
    expect(categories).toContain('spending');
    expect(categories).toContain('general');
  });

  it('each question has required fields', () => {
    for (const q of QUESTION_BANK) {
      expect(q.id).toBeTruthy();
      expect(q.text).toBeTruthy();
      expect(['yes_no', 'scale', 'dollar_amount']).toContain(q.responseType);
    }
  });

  it('scale questions have scaleLabels', () => {
    const scaleQuestions = QUESTION_BANK.filter((q) => q.responseType === 'scale');
    for (const q of scaleQuestions) {
      expect(q.scaleLabels).toBeDefined();
      expect(q.scaleLabels).toHaveLength(2);
    }
  });
});
