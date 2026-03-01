/**
 * Transition playbook calculator — pure functions.
 *
 * Computes retirement pay, income comparison, benefits transition costs,
 * TSP decisions, emergency fund adequacy, and time-phased checklists
 * for military-to-civilian transition (ETS / retirement / medical).
 */

import type {
  FinancialState,
  TransitionInput,
  TransitionPlan,
  RetirementPayEstimate,
  IncomeComparison,
  BenefitsTransition,
  TspSummary,
  EmergencyFundAdequacy,
  TransitionChecklist,
  TransitionChecklistItem,
} from '@fortress/types';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

export const RETIREMENT_MULTIPLIER_BRS = 0.02;
export const RETIREMENT_MULTIPLIER_LEGACY = 0.025;
export const MIN_RETIREMENT_YEARS = 20;
export const BRS_LUMP_SUM_DISCOUNT = 0.75; // actuarial reduction

/** Monthly VA disability compensation rates (2025, single veteran, no dependents). */
export const VA_DISABILITY_RATES: Record<number, number> = {
  0: 0,
  10: 171,
  20: 338,
  30: 524,
  40: 755,
  50: 1075,
  60: 1361,
  70: 1716,
  80: 1995,
  90: 2241,
  100: 3737,
};

/** Estimated monthly VGLI premiums for $400K coverage by age bracket. */
export const VGLI_RATES: Record<string, number> = {
  'under_30': 32,
  '30_34': 40,
  '35_39': 52,
  '40_44': 80,
  '45_49': 120,
  '50_plus': 200,
};

const ROUGH_TAX_RATE = 0.22; // federal + state approximation
const TRANSITION_BUFFER_MONTHS = 6;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// ────────────────────────────────────────────────────────────
// Sub-calculators
// ────────────────────────────────────────────────────────────

export function calculateRetirementPay(
  state: FinancialState,
  input: TransitionInput,
): RetirementPayEstimate {
  const system = state.military.retirementSystem;
  const yos = state.military.yearsOfService;
  const eligible = input.separationType === 'retirement' && yos >= MIN_RETIREMENT_YEARS;

  // High-3: approximate as current base pay (best available data)
  const highThreeBase = state.income.basePay;

  if (!eligible) {
    return {
      eligible: false,
      system,
      highThreeBase,
      multiplier: 0,
      annualRetirementPay: 0,
      monthlyRetirementPay: 0,
      brsLumpSum: 0,
      reducedMonthlyIfLumpSum: 0,
    };
  }

  const multiplier = system === 'legacy'
    ? RETIREMENT_MULTIPLIER_LEGACY
    : RETIREMENT_MULTIPLIER_BRS;

  const annualRetirementPay = Math.round(highThreeBase * 12 * multiplier * yos);
  const monthlyRetirementPay = Math.round(annualRetirementPay / 12);

  // BRS lump-sum option
  let brsLumpSum = 0;
  let reducedMonthlyIfLumpSum = monthlyRetirementPay;

  if (system === 'brs' && input.brsLumpSumPct > 0) {
    const lumpSumFraction = input.brsLumpSumPct / 100;
    // Present value of retirement stream × fraction × discount
    const estimatedPV = annualRetirementPay * 20; // rough 20-year PV
    brsLumpSum = Math.round(estimatedPV * lumpSumFraction * BRS_LUMP_SUM_DISCOUNT);
    reducedMonthlyIfLumpSum = Math.round(monthlyRetirementPay * (1 - lumpSumFraction));
  }

  return {
    eligible,
    system,
    highThreeBase,
    multiplier,
    annualRetirementPay,
    monthlyRetirementPay,
    brsLumpSum,
    reducedMonthlyIfLumpSum,
  };
}

export function calculateIncomeComparison(
  state: FinancialState,
  input: TransitionInput,
  retirementPay: RetirementPayEstimate,
): IncomeComparison {
  const currentGross = state.income.totalGross;
  const totalDeductions = state.deductions.federalTax + state.deductions.stateTax
    + state.deductions.fica + state.deductions.sgli + state.deductions.tricare
    + state.deductions.tspTraditional + state.deductions.tspRoth
    + state.deductions.otherDeductions;
  const currentNet = currentGross - totalDeductions;

  const civGross = input.expectedCivilianIncome;
  const civNet = Math.round(civGross * (1 - ROUGH_TAX_RATE));

  const retIncome = retirementPay.eligible
    ? (retirementPay.brsLumpSum > 0 ? retirementPay.reducedMonthlyIfLumpSum : retirementPay.monthlyRetirementPay)
    : 0;

  const vaRate = VA_DISABILITY_RATES[input.vaDisabilityRating] ?? 0;

  const totalPost = civNet + retIncome + vaRate;
  const delta = totalPost - currentNet;

  return {
    currentMilitaryGross: currentGross,
    currentMilitaryNet: Math.round(currentNet),
    projectedCivilianGross: civGross,
    projectedCivilianNet: civNet,
    retirementIncome: retIncome,
    vaDisabilityIncome: vaRate,
    totalPostServiceIncome: totalPost,
    monthlyDelta: delta,
  };
}

export function calculateBenefitsTransition(
  state: FinancialState,
  input: TransitionInput,
): BenefitsTransition {
  const tricareCost = state.deductions.tricare;
  const civilianHealthCost = input.civilianHealthInsuranceCost;

  // SGLI → VGLI estimate (use 35-39 bracket as default)
  const vgliCost = VGLI_RATES['35_39'];

  // GI Bill: eligible if served 36+ months active duty (simplified)
  const giEligible = state.military.component === 'active'
    && state.military.yearsOfService >= 3;

  return {
    tricareCost,
    civilianHealthCost,
    healthCostDelta: civilianHealthCost - tricareCost,
    sgliCoverage: state.deductions.sgliCoverage,
    vgliEstimatedCost: vgliCost,
    giEligible,
  };
}

export function calculateTspSummary(
  state: FinancialState,
  input: TransitionInput,
): TspSummary {
  const balance = state.assets.tspBalance;

  switch (input.tspAction) {
    case 'leave':
      return {
        action: 'Leave funds in TSP',
        taxImplication: 'No tax event. Funds continue growing tax-deferred until withdrawal.',
        balance,
      };
    case 'rollover_ira':
      return {
        action: 'Roll over to civilian IRA',
        taxImplication: 'No tax event if rolled to Traditional IRA. Roth TSP can roll to Roth IRA tax-free.',
        balance,
      };
    case 'partial_withdrawal': {
      const withdrawalAmt = Math.round(balance * (input.tspWithdrawalPct / 100));
      const taxHit = Math.round(withdrawalAmt * ROUGH_TAX_RATE);
      const earlyPenalty = state.military.yearsOfService < 20
        ? Math.round(withdrawalAmt * 0.10) : 0;
      return {
        action: `Withdraw ${input.tspWithdrawalPct}% (${fmt(withdrawalAmt)})`,
        taxImplication: `Estimated tax: ${fmt(taxHit)}.${earlyPenalty > 0 ? ` Early withdrawal penalty (age <59½): ${fmt(earlyPenalty)}.` : ''} Remaining ${fmt(balance - withdrawalAmt)} stays in TSP.`,
        balance,
      };
    }
  }
}

export function calculateEmergencyAdequacy(
  state: FinancialState,
  input: TransitionInput,
): EmergencyFundAdequacy {
  const monthlyExpenses = state.expenses.totalMonthly + input.civilianHealthInsuranceCost;
  const recommended = monthlyExpenses > 0
    ? Math.round(monthlyExpenses * TRANSITION_BUFFER_MONTHS)
    : 0;

  const available = state.assets.totalLiquid;
  const months = monthlyExpenses > 0
    ? Math.round((available / monthlyExpenses) * 10) / 10
    : 0;

  const gap = Math.max(0, recommended - available);

  return { months, recommended, gap };
}

export function buildTransitionChecklists(
  state: FinancialState,
  input: TransitionInput,
): TransitionChecklist[] {
  const checklists: TransitionChecklist[] = [];

  // 12 months out
  const phase12: TransitionChecklistItem[] = [
    {
      id: 'tap', title: 'Attend Transition Assistance Program (TAP)',
      description: 'Mandatory 5-day workshop covering benefits, employment, and financial planning.',
      mechanism: 'Contact installation Transition Office to schedule',
      category: 'career',
    },
    {
      id: 'resume', title: 'Start building civilian resume',
      description: 'Translate military experience into civilian terms. Use USAJOBS resume builder.',
      mechanism: 'USAJOBS.gov > Resume Builder',
      category: 'career',
    },
    {
      id: 'budget', title: 'Build post-service budget',
      description: 'Project civilian income vs expenses. Account for lost BAH/BAS and new healthcare costs.',
      mechanism: 'Fortress Transition Planner (this tool)',
      category: 'financial',
    },
    {
      id: 'gi-bill', title: 'Verify GI Bill eligibility',
      description: 'Confirm Post-9/11 GI Bill months remaining and transfer status.',
      mechanism: 'va.gov > Education > Check GI Bill Benefits',
      category: 'benefits',
    },
  ];

  // 6 months out
  const phase6: TransitionChecklistItem[] = [
    {
      id: 'va-claim', title: 'File VA disability claim',
      description: 'Start Benefits Delivery at Discharge (BDD) claim 180–90 days before separation.',
      mechanism: 'va.gov > Disability > File a Claim',
      category: 'benefits',
    },
    {
      id: 'tsp-plan', title: 'Decide TSP strategy',
      description: 'Choose to leave, roll over, or withdraw TSP funds. Consider tax implications.',
      mechanism: 'tsp.gov > Withdrawals > Separating from Service',
      category: 'financial',
    },
    {
      id: 'health', title: 'Research healthcare options',
      description: 'Evaluate VA healthcare, TRICARE Retired (if eligible), or civilian employer plans.',
      mechanism: 'va.gov > Health Care > Apply',
      category: 'benefits',
    },
    {
      id: 'emergency-fund', title: 'Build 6-month emergency fund',
      description: `Target ${fmt(state.expenses.totalMonthly * 6)} to cover transition gap.`,
      mechanism: 'myPay > Allotments > Savings',
      category: 'financial',
    },
  ];

  // 90 days out
  const phase90: TransitionChecklistItem[] = [
    {
      id: 'sgli-convert', title: 'Apply for SGLI to VGLI conversion',
      description: 'Must apply within 240 days of separation. No medical exam required.',
      mechanism: 'va.gov > Life Insurance > VGLI',
      category: 'benefits',
    },
    {
      id: 'allotments', title: 'Review and cancel military allotments',
      description: 'Cancel auto-deductions that will no longer apply after separation.',
      mechanism: 'myPay > Allotments > Review',
      category: 'financial',
    },
    {
      id: 'legal', title: 'Update legal documents',
      description: 'Review will, power of attorney, and beneficiary designations.',
      mechanism: 'Installation Legal Assistance Office',
      category: 'legal',
    },
  ];

  if (input.separationType === 'retirement') {
    phase90.push({
      id: 'retirement-app', title: 'Submit retirement application',
      description: 'File DD Form 2656 (Data for Payment of Retired Personnel).',
      mechanism: 'DFAS > Retired Military & Annuitants',
      category: 'financial',
    });
  }

  // 30 days out
  const phase30: TransitionChecklistItem[] = [
    {
      id: 'final-les', title: 'Verify final LES',
      description: 'Ensure all pay, leave, and deductions are accurate on final pay statement.',
      mechanism: 'myPay > Leave and Earnings Statement',
      category: 'financial',
    },
    {
      id: 'direct-deposit', title: 'Update direct deposit',
      description: 'Ensure final pay and any retirement pay go to correct civilian bank account.',
      mechanism: 'myPay > Direct Deposit',
      category: 'financial',
    },
    {
      id: 'id-card', title: 'Obtain veteran ID card',
      description: 'Apply for Veteran Health Identification Card (VHIC) or get DD-214 certified copies.',
      mechanism: 'va.gov > Records > Get Veteran ID Cards',
      category: 'legal',
    },
    {
      id: 'va-enroll', title: 'Enroll in VA healthcare',
      description: 'Apply for VA healthcare if not already enrolled. Must apply within combat veteran period for priority.',
      mechanism: 'va.gov > Health Care > Apply',
      category: 'benefits',
    },
  ];

  // Filter by months until separation
  const months = input.monthsUntilSeparation;
  if (months >= 12) checklists.push({ phase: '12_months', label: '12 Months Out', items: phase12 });
  if (months >= 6) checklists.push({ phase: '6_months', label: '6 Months Out', items: phase6 });
  if (months >= 3) checklists.push({ phase: '90_days', label: '90 Days Out', items: phase90 });
  checklists.push({ phase: '30_days', label: '30 Days Out', items: phase30 });

  return checklists;
}

// ────────────────────────────────────────────────────────────
// Recommendation builder
// ────────────────────────────────────────────────────────────

function buildRecommendation(
  input: TransitionInput,
  retPay: RetirementPayEstimate,
  income: IncomeComparison,
  emergency: EmergencyFundAdequacy,
): string {
  const parts: string[] = [];

  if (retPay.eligible) {
    parts.push(
      `As a ${retPay.system === 'brs' ? 'BRS' : 'Legacy'} retiree, your estimated monthly retirement pay is ${fmt(retPay.monthlyRetirementPay)}.`,
    );
    if (retPay.brsLumpSum > 0) {
      parts.push(
        `The ${input.brsLumpSumPct}% lump-sum option would provide ${fmt(retPay.brsLumpSum)} upfront but reduce monthly pay to ${fmt(retPay.reducedMonthlyIfLumpSum)}.`,
      );
    }
  } else if (input.separationType === 'retirement') {
    parts.push('You do not yet meet the 20-year retirement threshold.');
  }

  if (income.monthlyDelta >= 0) {
    parts.push(
      `Your projected post-service income (${fmt(income.totalPostServiceIncome)}/mo) exceeds your current military net (${fmt(income.currentMilitaryNet)}/mo) by ${fmt(income.monthlyDelta)}.`,
    );
  } else {
    parts.push(
      `Your projected post-service income is ${fmt(Math.abs(income.monthlyDelta))}/mo less than your current military net. Plan for this income gap.`,
    );
  }

  if (emergency.gap > 0) {
    parts.push(
      `Your emergency fund is ${emergency.months.toFixed(1)} months — target 6 months (${fmt(emergency.recommended)}). Gap: ${fmt(emergency.gap)}.`,
    );
  } else {
    parts.push('Your emergency fund meets the recommended 6-month transition buffer.');
  }

  parts.push(
    'Meet with your installation PFC or Military OneSource advisor for personalized transition counseling.',
  );

  return parts.join(' ');
}

// ────────────────────────────────────────────────────────────
// Main orchestrator
// ────────────────────────────────────────────────────────────

export function calculateTransitionPlan(
  state: FinancialState,
  input: TransitionInput,
): TransitionPlan {
  const retirementPay = calculateRetirementPay(state, input);
  const incomeComparison = calculateIncomeComparison(state, input, retirementPay);
  const benefits = calculateBenefitsTransition(state, input);
  const tspSummary = calculateTspSummary(state, input);
  const emergencyFundAdequacy = calculateEmergencyAdequacy(state, input);
  const checklists = buildTransitionChecklists(state, input);
  const recommendation = buildRecommendation(input, retirementPay, incomeComparison, emergencyFundAdequacy);

  return {
    retirementPay,
    incomeComparison,
    benefits,
    tspSummary,
    emergencyFundAdequacy,
    checklists,
    recommendation,
  };
}
