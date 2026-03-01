/**
 * Pure function content builder for the Financial Readiness Summary PDF.
 * No rendering dependencies — produces a structured data object consumed
 * by the pdf-renderer service.
 */

import type { FinancialState, RiskAssessment, ActionPlan, Action } from '@fortress/types';
import { ACTION_PLAN_DISCLAIMER } from './action-generator';

// --- Types ---

export interface PdfMilitaryProfile {
  payGrade: string;
  yearsOfService: number;
  dependents: number;
  dutyStation: string;
  component: string;
  retirementSystem: string;
}

export interface PdfRiskSummary {
  score: number;
  tier: 'green' | 'yellow' | 'red';
  dataQuality: number;
}

export interface PdfFinding {
  title: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  impact: string;
  pointsDeducted: number;
}

export interface PdfAction {
  title: string;
  mechanism: string;
  deadline: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
}

export interface PdfActionTier {
  tier: string;
  label: string;
  actions: PdfAction[];
}

export interface PdfSnapshotRow {
  label: string;
  value: string;
}

export interface PdfContent {
  generatedAt: string;
  military: PdfMilitaryProfile;
  riskSummary: PdfRiskSummary;
  findings: PdfFinding[];
  actionPlan: PdfActionTier[];
  financialSnapshot: PdfSnapshotRow[];
  disclaimer: string;
}

// --- Helpers ---

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function componentLabel(c: string): string {
  switch (c) {
    case 'active': return 'Active Duty';
    case 'reserve': return 'Reserve';
    case 'guard': return 'National Guard';
    default: return c;
  }
}

function retirementLabel(r: string): string {
  switch (r) {
    case 'brs': return 'BRS';
    case 'legacy': return 'Legacy (High-3)';
    default: return 'Unknown';
  }
}

function mapActions(actions: Action[]): PdfAction[] {
  return actions.map((a) => ({
    title: a.title,
    mechanism: a.mechanism,
    deadline: a.deadline,
    difficulty: a.difficulty,
    estimatedMinutes: a.estimatedMinutes,
  }));
}

// --- Main builder ---

export function buildPdfContent(
  state: FinancialState,
  risk: RiskAssessment,
  plan: ActionPlan,
): PdfContent {
  // Military profile
  const military: PdfMilitaryProfile = {
    payGrade: state.military.payGrade,
    yearsOfService: state.military.yearsOfService,
    dependents: state.military.dependents,
    dutyStation: state.military.dutyStation || 'Not specified',
    component: componentLabel(state.military.component),
    retirementSystem: retirementLabel(state.military.retirementSystem),
  };

  // Risk summary
  const riskSummary: PdfRiskSummary = {
    score: risk.overallScore,
    tier: risk.tier,
    dataQuality: risk.dataQuality,
  };

  // Findings (sorted critical → warning → info)
  const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
  const findings: PdfFinding[] = [...risk.findings]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .map((f) => ({
      title: f.title,
      severity: f.severity,
      description: f.description,
      impact: f.impact,
      pointsDeducted: f.pointsDeducted,
    }));

  // Action plan grouped by tier
  const actionPlan: PdfActionTier[] = [];
  if (plan.immediate.length > 0) {
    actionPlan.push({ tier: 'immediate', label: 'This Week (7-Day)', actions: mapActions(plan.immediate) });
  }
  if (plan.stabilization.length > 0) {
    actionPlan.push({ tier: 'stabilization', label: 'Next 30 Days', actions: mapActions(plan.stabilization) });
  }
  if (plan.compounding.length > 0) {
    actionPlan.push({ tier: 'compounding', label: '90-Day Goals', actions: mapActions(plan.compounding) });
  }

  // Financial snapshot highlights
  const totalDebtPayments = state.debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const totalDebtBalance = state.debts.reduce((sum, d) => sum + d.balance, 0);

  const financialSnapshot: PdfSnapshotRow[] = [
    { label: 'Total Gross Income', value: fmt(state.income.totalGross) },
    { label: 'Total Monthly Expenses', value: fmt(state.expenses.totalMonthly) },
    { label: 'Total Liquid Assets', value: fmt(state.assets.totalLiquid) },
    { label: 'Emergency Fund', value: `${state.risk.emergencyFundMonths.toFixed(1)} months` },
    { label: 'TSP Balance', value: fmt(state.assets.tspBalance) },
    { label: 'TSP Contribution', value: pct(state.deductions.tspContributionPct) },
    { label: 'Debt-to-Income Ratio', value: pct(state.risk.debtToIncomeRatio) },
    { label: 'Total Debt Balance', value: fmt(totalDebtBalance) },
    { label: 'Total Debt Payments', value: `${fmt(totalDebtPayments)}/mo` },
    { label: 'SGLI Coverage', value: fmt(state.deductions.sgliCoverage) },
    { label: 'Number of Debts', value: String(state.debts.length) },
    { label: 'High-Interest Debt', value: fmt(state.risk.highInterestDebtTotal) },
  ];

  return {
    generatedAt: new Date().toISOString(),
    military,
    riskSummary,
    findings,
    actionPlan,
    financialSnapshot,
    disclaimer: ACTION_PLAN_DISCLAIMER,
  };
}
