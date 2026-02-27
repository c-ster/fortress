/**
 * Risk scoring engine — Phase 0 (3 rules).
 *
 * Pure function: no side effects, no Zustand, no React.
 * Reads pre-computed risk metrics from the FinancialState (set by computeDerived).
 *
 * Rules:
 *   1. Emergency Fund  (25% weight) — liquid savings vs essential expenses
 *   2. High-Interest Debt (20% weight) — debts > 15% APR scaled by income
 *   3. SGLI Gap (15% weight) — binary: dependents + under-coverage
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

// --- Phase 0 rule set ---

const PHASE_0_RULES: RiskRule[] = [
  emergencyFundRule,
  highInterestDebtRule,
  sgliGapRule,
];

// --- Public API ---

/**
 * Calculate an overall risk score from the financial state.
 * Pure function — safe to call anywhere, memoize with useMemo.
 */
export function calculateRiskScore(state: FinancialState): RiskAssessment {
  const findings: RiskFinding[] = [];

  for (const rule of PHASE_0_RULES) {
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
