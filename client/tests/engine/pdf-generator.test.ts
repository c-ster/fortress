import { describe, it, expect } from 'vitest';
import { buildPdfContent } from '../../src/engine/pdf-generator';
import { ACTION_PLAN_DISCLAIMER } from '../../src/engine/action-generator';
import type { FinancialState, RiskAssessment, ActionPlan } from '@fortress/types';

// --- Factories ---

function makeState(overrides: Partial<FinancialState> = {}): FinancialState {
  return {
    income: {
      basePay: 3637, bah: 1800, bas: 407, cola: 0,
      specialPay: 0, otherIncome: 0,
      totalGross: 5844, totalTaxable: 3637, totalNonTaxable: 2207,
    },
    deductions: {
      federalTax: 400, stateTax: 150, fica: 278, sgli: 27,
      sgliCoverage: 400_000, tspTraditional: 0, tspRoth: 73,
      tspContributionPct: 0.02, tricare: 0, otherDeductions: 0,
      allotments: [],
    },
    expenses: {
      housing: 1800, utilities: 200, transportation: 350,
      food: 400, childcare: 0, insurance: 100,
      subscriptions: 80, discretionary: 300,
      totalEssential: 2850, totalMonthly: 3230,
    },
    debts: [
      {
        id: '1', name: 'Car Loan', type: 'auto', balance: 12000,
        apr: 6.5, minimumPayment: 280, monthlyPayment: 280, preService: true,
      },
    ],
    assets: {
      checkingBalance: 1200, savingsBalance: 800,
      emergencyFund: 0, tspBalance: 8500,
      otherInvestments: 0, totalLiquid: 2000,
    },
    military: {
      payGrade: 'E5', yearsOfService: 6, dependents: 2,
      dutyStation: 'Fort Liberty', component: 'active',
      retirementSystem: 'brs', scraEligible: false,
    },
    risk: {
      emergencyFundMonths: 0.7, debtToIncomeRatio: 0.05,
      highInterestDebtTotal: 0, sgliAdequate: false,
      tspMatchCaptured: false, scraOpportunity: 0,
      paydaySpikeSeverity: 0,
    },
    meta: {
      dataSource: 'manual', lastUpdated: '2025-01-15',
      completeness: 0.75, confidenceScores: {},
    },
    actionStatuses: {},
    checkIns: [],
    ...overrides,
  };
}

function makeRisk(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
  return {
    overallScore: 55,
    tier: 'yellow',
    findings: [
      {
        id: 'ef-1', category: 'emergency_fund', severity: 'critical',
        title: 'Emergency Fund Below 1 Month',
        description: 'You have 0.7 months of essential expenses saved.',
        impact: 'Risk of financial crisis if unexpected expense occurs.',
        actionId: 'a-1', pointsDeducted: 25, weight: 25,
      },
      {
        id: 'sgli-1', category: 'sgli_coverage', severity: 'warning',
        title: 'SGLI Coverage Gap',
        description: '$400K SGLI with 2 dependents.',
        impact: 'Coverage may be insufficient for family needs.',
        actionId: 'a-2', pointsDeducted: 15, weight: 15,
      },
    ],
    dataQuality: 0.75,
    generatedAt: '2025-01-15T12:00:00Z',
    ...overrides,
  };
}

function makePlan(overrides: Partial<ActionPlan> = {}): ActionPlan {
  return {
    immediate: [
      {
        id: 'a-1', riskFindingId: 'ef-1',
        title: 'Set up savings allotment on myPay',
        description: 'Create automatic transfer.',
        mechanism: 'myPay > Allotments > Add New > Savings',
        amount: 250, deadline: 'Before February 1',
        estimatedImpact: 'Builds $1,500 in 6 months.',
        difficulty: 'easy', estimatedMinutes: 10, status: 'pending',
      },
    ],
    stabilization: [],
    compounding: [],
    ...overrides,
  };
}

// --- Tests ---

describe('buildPdfContent', () => {
  it('produces all required sections', () => {
    const content = buildPdfContent(makeState(), makeRisk(), makePlan());
    expect(content.generatedAt).toBeTruthy();
    expect(content.military).toBeDefined();
    expect(content.riskSummary).toBeDefined();
    expect(content.findings).toBeDefined();
    expect(content.actionPlan).toBeDefined();
    expect(content.financialSnapshot).toBeDefined();
    expect(content.disclaimer).toBeDefined();
  });

  it('extracts military profile from FSM', () => {
    const content = buildPdfContent(makeState(), makeRisk(), makePlan());
    expect(content.military.payGrade).toBe('E5');
    expect(content.military.yearsOfService).toBe(6);
    expect(content.military.dependents).toBe(2);
    expect(content.military.dutyStation).toBe('Fort Liberty');
    expect(content.military.component).toBe('Active Duty');
    expect(content.military.retirementSystem).toBe('BRS');
  });

  it('includes risk score and tier', () => {
    const content = buildPdfContent(makeState(), makeRisk(), makePlan());
    expect(content.riskSummary.score).toBe(55);
    expect(content.riskSummary.tier).toBe('yellow');
    expect(content.riskSummary.dataQuality).toBe(0.75);
  });

  it('sorts findings by severity (critical first)', () => {
    const content = buildPdfContent(makeState(), makeRisk(), makePlan());
    expect(content.findings).toHaveLength(2);
    expect(content.findings[0].severity).toBe('critical');
    expect(content.findings[1].severity).toBe('warning');
  });

  it('handles empty findings', () => {
    const risk = makeRisk({ findings: [] });
    const content = buildPdfContent(makeState(), risk, makePlan());
    expect(content.findings).toHaveLength(0);
  });

  it('groups action plan by tier', () => {
    const plan = makePlan({
      stabilization: [{
        id: 'a-2', riskFindingId: 'sgli-1',
        title: 'Increase SGLI coverage', description: 'Call SGLI.',
        mechanism: 'Call SGLI office', deadline: 'Within 30 days',
        estimatedImpact: 'Full coverage.', difficulty: 'medium',
        estimatedMinutes: 15, status: 'pending',
      }],
    });
    const content = buildPdfContent(makeState(), makeRisk(), plan);
    expect(content.actionPlan).toHaveLength(2);
    expect(content.actionPlan[0].tier).toBe('immediate');
    expect(content.actionPlan[1].tier).toBe('stabilization');
  });

  it('handles empty action plan', () => {
    const plan = makePlan({ immediate: [], stabilization: [], compounding: [] });
    const content = buildPdfContent(makeState(), makeRisk(), plan);
    expect(content.actionPlan).toHaveLength(0);
  });

  it('includes financial snapshot metrics', () => {
    const content = buildPdfContent(makeState(), makeRisk(), makePlan());
    const labels = content.financialSnapshot.map((r) => r.label);
    expect(labels).toContain('Total Gross Income');
    expect(labels).toContain('Emergency Fund');
    expect(labels).toContain('Debt-to-Income Ratio');
    expect(labels).toContain('TSP Balance');
    expect(labels).toContain('SGLI Coverage');
  });

  it('uses the official disclaimer', () => {
    const content = buildPdfContent(makeState(), makeRisk(), makePlan());
    expect(content.disclaimer).toBe(ACTION_PLAN_DISCLAIMER);
  });
});
