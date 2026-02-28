/**
 * Risk scoring engine — 7 rules, 100 total points.
 *
 * Pure function: no side effects, no Zustand, no React.
 * Reads pre-computed risk metrics from the FinancialState (set by computeDerived).
 *
 * Rules:
 *   1. Emergency Fund     (25% weight) — liquid savings vs essential expenses
 *   2. High-Interest Debt (20% weight) — debts > 15% APR scaled by income
 *   3. SGLI Gap           (15% weight) — binary: dependents + under-coverage
 *   4. TSP Match          (15% weight) — BRS contribution vs 5% match threshold
 *   5. DTI Ratio          (10% weight) — debt payments vs gross income
 *   6. SCRA Opportunity   (10% weight) — potential savings on pre-service debt
 *   7. Payday Spike        (5% weight) — expense clustering around paydays
 *
 * Score = max(0, 100 − totalDeducted).  Tier: ≥80 green, 50–79 yellow, <50 red.
 */

import type {
  FinancialState,
  RiskAssessment,
  RiskFinding,
  RiskCategory,
} from '@fortress/types';
import { formatCurrencyWhole } from '../utils/format-currency';

// --- Internal types ---

interface RiskRuleResult {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  impact: string;
  actionId: string;
  pointsDeducted: number;
}

interface RiskRule {
  category: RiskCategory;
  weight: number;
  evaluate: (state: FinancialState) => RiskRuleResult | null;
}

// --- Rule implementations ---

const emergencyFundRule: RiskRule = {
  category: 'emergency_fund',
  weight: 25,
  evaluate(state) {
    const { totalEssential } = state.expenses;
    const { totalLiquid } = state.assets;

    // Skip if no expense data — can't compute ratio
    if (totalEssential === 0) return null;

    const months = state.risk.emergencyFundMonths;

    if (months >= 3) return null; // Healthy — no finding

    if (months < 1) {
      return {
        severity: 'critical',
        title: 'Emergency Fund Below 1 Month',
        description:
          `You have ${months.toFixed(1)} months of essential expenses covered. ` +
          'Military financial experts recommend at least 3 months.',
        impact:
          `${formatCurrencyWhole(totalLiquid)} liquid savings vs ` +
          `${formatCurrencyWhole(totalEssential)}/mo essential expenses.`,
        actionId: 'build_emergency_fund',
        pointsDeducted: 25,
      };
    }

    // 1–3 months: linear scale from 25 (at 1 mo) to 0 (at 3 mo)
    const pts = Math.round(25 * (3 - months) / 2);

    return {
      severity: 'warning',
      title: 'Emergency Fund Below 3 Months',
      description:
        `You have ${months.toFixed(1)} months of essential expenses covered. ` +
        'Build toward 3 months for full readiness.',
      impact:
        `${formatCurrencyWhole(totalLiquid)} liquid savings vs ` +
        `${formatCurrencyWhole(totalEssential)}/mo essential expenses.`,
      actionId: 'build_emergency_fund',
      pointsDeducted: pts,
    };
  },
};

const highInterestDebtRule: RiskRule = {
  category: 'high_interest_debt',
  weight: 20,
  evaluate(state) {
    const debt = state.risk.highInterestDebtTotal;
    if (debt === 0) return null;

    const gross = state.income.totalGross;

    // If zero income but debt exists, deduct full weight
    if (gross === 0) {
      return {
        severity: 'critical',
        title: 'High-Interest Debt With No Income',
        description:
          `You carry ${formatCurrencyWhole(debt)} in debt above 15% APR ` +
          'with no reported income.',
        impact: 'Eliminating this debt should be the top priority.',
        actionId: 'eliminate_high_interest_debt',
        pointsDeducted: 20,
      };
    }

    const threshold = gross * 2; // 2× monthly income
    const ratio = Math.min(debt / threshold, 1.0);
    const pts = Math.round(20 * ratio);

    if (pts === 0) return null;

    const severity = ratio >= 0.5 ? 'critical' : 'warning';

    return {
      severity,
      title: 'High-Interest Debt',
      description:
        `You carry ${formatCurrencyWhole(debt)} in debt above 15% APR ` +
        `against ${formatCurrencyWhole(gross)}/mo gross income.`,
      impact: 'Eliminating this debt frees up cash flow for savings and readiness.',
      actionId: 'eliminate_high_interest_debt',
      pointsDeducted: pts,
    };
  },
};

const sgliGapRule: RiskRule = {
  category: 'sgli_coverage',
  weight: 15,
  evaluate(state) {
    if (state.risk.sgliAdequate) return null;

    const deps = state.military.dependents;
    const coverage = state.deductions.sgliCoverage;
    const gap = 500_000 - coverage;
    const monthlyCost = Math.round((gap / 100_000) * 6);

    return {
      severity: 'critical',
      title: 'SGLI Coverage Gap',
      description:
        `You have ${deps} dependent${deps !== 1 ? 's' : ''} but only ` +
        `${formatCurrencyWhole(coverage)} in SGLI coverage. ` +
        'Maximum coverage of $500,000 is strongly recommended for service members with dependents.',
      impact: `Increasing to $500,000 costs approximately $${monthlyCost}/month.`,
      actionId: 'maximize_sgli_coverage',
      pointsDeducted: 15,
    };
  },
};

const tspMatchRule: RiskRule = {
  category: 'tsp_match',
  weight: 15,
  evaluate(state) {
    // Only applies to BRS retirement system
    if (state.military.retirementSystem !== 'brs') return null;

    const { basePay } = state.income;
    if (basePay === 0) return null; // No income data

    const pct = state.deductions.tspContributionPct;
    if (pct >= 0.05) return null; // Already capturing full match

    const pts = Math.round(15 * (0.05 - pct) / 0.05);
    if (pts === 0) return null;

    const severity = pct < 0.01 ? 'critical' : 'warning';
    const annualLost = basePay * 12 * (0.05 - pct);
    // 20-year compounded estimate at 7% average growth
    const compounded20yr = annualLost * ((Math.pow(1.07, 20) - 1) / 0.07);

    return {
      severity,
      title: 'TSP Match Not Fully Captured',
      description:
        `You're contributing ${(pct * 100).toFixed(1)}% to TSP, but the BRS match ` +
        'requires 5% to capture the full government match. ' +
        `You're leaving approximately ${formatCurrencyWhole(annualLost)}/year on the table.`,
      impact:
        `Over 20 years, the uncaptured match could grow to ${formatCurrencyWhole(compounded20yr)} ` +
        'with compounding at 7% average growth.',
      actionId: 'increase_tsp_contribution',
      pointsDeducted: pts,
    };
  },
};

const dtiRule: RiskRule = {
  category: 'debt_to_income',
  weight: 10,
  evaluate(state) {
    const gross = state.income.totalGross;
    if (gross === 0) return null; // No income data

    const dti = state.risk.debtToIncomeRatio;
    if (dti <= 0.30) return null; // Healthy

    let pts: number;
    let severity: 'critical' | 'warning';

    if (dti > 0.40) {
      pts = 10;
      severity = 'critical';
    } else {
      // 0.30–0.40: linear scale
      pts = Math.round(10 * (dti - 0.30) / 0.10);
      severity = 'warning';
      if (pts === 0) return null;
    }

    const pctDisplay = (dti * 100).toFixed(0);

    return {
      severity,
      title: 'High Debt-to-Income Ratio',
      description:
        `Your debt-to-income ratio is ${pctDisplay}%, which exceeds the recommended 30% threshold. ` +
        'High DTI can be a flag in security clearance reviews and limits financial flexibility.',
      impact:
        `You're spending ${formatCurrencyWhole(dti * gross)} of your ` +
        `${formatCurrencyWhole(gross)}/mo gross income on debt payments.`,
      actionId: 'reduce_debt_to_income',
      pointsDeducted: pts,
    };
  },
};

const scraOpportunityRule: RiskRule = {
  category: 'scra_opportunity',
  weight: 10,
  evaluate(state) {
    const monthlySavings = state.risk.scraOpportunity;
    if (monthlySavings === 0) return null;

    const ratio = Math.min(monthlySavings / 200, 1.0);
    const pts = Math.round(10 * ratio);
    if (pts === 0) return null;

    const severity = monthlySavings >= 100 ? 'critical' : 'warning';
    const annualSavings = monthlySavings * 12;

    return {
      severity,
      title: 'SCRA Rate Reduction Available',
      description:
        'The Servicemembers Civil Relief Act (SCRA) can cap interest rates at 6% on pre-service debt. ' +
        'You have eligible debt that could benefit from this protection.',
      impact:
        `Requesting SCRA protection could save ${formatCurrencyWhole(monthlySavings)}/month ` +
        `(${formatCurrencyWhole(annualSavings)}/year) in interest charges.`,
      actionId: 'invoke_scra_protection',
      pointsDeducted: pts,
    };
  },
};

const paydaySpikeRule: RiskRule = {
  category: 'payday_spike',
  weight: 5,
  evaluate(state) {
    const severity_val = state.risk.paydaySpikeSeverity;

    // Skip if below threshold or no data (default 0)
    if (severity_val <= 0.5) return null;

    const pts = Math.round(5 * (severity_val - 0.5) / 0.5);
    if (pts === 0) return null;

    const severity = severity_val >= 0.8 ? 'critical' : 'warning';

    return {
      severity,
      title: 'Expense Clustering Around Paydays',
      description:
        'A large portion of your expenses are concentrated around paydays, ' +
        'creating cash flow volatility that increases the risk of overdrafts or missed payments.',
      impact:
        'Spreading bills across the month and setting up mid-month allotments can smooth cash flow.',
      actionId: 'smooth_payday_expenses',
      pointsDeducted: pts,
    };
  },
};

// --- Rule set (7 rules, 100 total weight) ---

const RULES: RiskRule[] = [
  emergencyFundRule,
  highInterestDebtRule,
  sgliGapRule,
  tspMatchRule,
  dtiRule,
  scraOpportunityRule,
  paydaySpikeRule,
];

// --- Public API ---

/**
 * Calculate an overall risk score from the financial state.
 * Pure function — safe to call anywhere, memoize with useMemo.
 */
export function calculateRiskScore(state: FinancialState): RiskAssessment {
  const findings: RiskFinding[] = [];

  for (const rule of RULES) {
    const result = rule.evaluate(state);
    if (result) {
      findings.push({
        id: `risk_${rule.category}`,
        category: rule.category,
        severity: result.severity,
        title: result.title,
        description: result.description,
        impact: result.impact,
        actionId: result.actionId,
        pointsDeducted: result.pointsDeducted,
        weight: rule.weight,
      });
    }
  }

  // Sort by severity (most impactful first)
  findings.sort((a, b) => b.pointsDeducted - a.pointsDeducted);

  const totalDeducted = findings.reduce((sum, f) => sum + f.pointsDeducted, 0);
  const overallScore = Math.max(0, 100 - totalDeducted);

  const tier: RiskAssessment['tier'] =
    overallScore >= 80 ? 'green' : overallScore >= 50 ? 'yellow' : 'red';

  return {
    overallScore,
    tier,
    findings,
    dataQuality: state.meta.completeness,
    generatedAt: new Date().toISOString(),
  };
}
