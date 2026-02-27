import { describe, it, expect } from 'vitest';
import { computeDerived } from '../../src/stores/financial-state';
import { calculateRiskScore } from '../../src/engine/risk-engine';
import type { FinancialState, PayGrade } from '@fortress/types';

/**
 * Factory: creates a default FinancialState, applies overrides,
 * then runs computeDerived() so all risk.* metrics are populated.
 */
function makeState(overrides: Record<string, unknown> = {}): FinancialState {
  const base: FinancialState = {
    income: {
      basePay: 0, bah: 0, bas: 0, cola: 0, specialPay: 0, otherIncome: 0,
      totalGross: 0, totalTaxable: 0, totalNonTaxable: 0,
    },
    deductions: {
      federalTax: 0, stateTax: 0, fica: 0, sgli: 0, sgliCoverage: 0,
      tspTraditional: 0, tspRoth: 0, tspContributionPct: 0,
      tricare: 0, otherDeductions: 0, allotments: [],
    },
    expenses: {
      housing: 0, utilities: 0, transportation: 0, food: 0,
      childcare: 0, insurance: 0, subscriptions: 0, discretionary: 0,
      totalEssential: 0, totalMonthly: 0,
    },
    debts: [],
    assets: {
      checkingBalance: 0, savingsBalance: 0, emergencyFund: 0,
      tspBalance: 0, otherInvestments: 0, totalLiquid: 0,
    },
    military: {
      payGrade: 'E3' as PayGrade, yearsOfService: 2, dependents: 0,
      dutyStation: '', component: 'active', retirementSystem: 'brs',
      scraEligible: false,
    },
    risk: {
      emergencyFundMonths: 0, debtToIncomeRatio: 0, highInterestDebtTotal: 0,
      sgliAdequate: true, tspMatchCaptured: false, scraOpportunity: 0,
      paydaySpikeSeverity: 0,
    },
    meta: {
      dataSource: 'manual', lastUpdated: '', completeness: 0, confidenceScores: {},
    },
    actionStatuses: {},
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (base as Record<string, unknown>)[key] = {
        ...(base as Record<string, Record<string, unknown>>)[key],
        ...(value as Record<string, unknown>),
      };
    } else {
      (base as Record<string, unknown>)[key] = value;
    }
  }

  return computeDerived(base);
}

describe('calculateRiskScore', () => {
  it('scores E3 with poor finances as red (all 3 findings)', () => {
    const state = makeState({
      income: { basePay: 2400, bah: 900, bas: 400 },
      assets: { savingsBalance: 200, checkingBalance: 0 },
      expenses: { housing: 900, utilities: 100, transportation: 200, food: 400 },
      military: { payGrade: 'E3' as PayGrade, dependents: 2 },
      deductions: { sgliCoverage: 100000 },
      debts: [
        {
          id: '1', name: 'Credit Card', type: 'credit_card',
          balance: 5000, apr: 22, minimumPayment: 150,
          monthlyPayment: 150, preService: false,
        },
      ],
    });

    const assessment = calculateRiskScore(state);

    expect(assessment.tier).toBe('red');
    expect(assessment.findings).toHaveLength(3);
    expect(assessment.overallScore).toBeLessThan(50);

    // Emergency fund: 200 liquid / 1600 essential = 0.125 months → critical, 25 pts
    const efFinding = assessment.findings.find((f) => f.category === 'emergency_fund');
    expect(efFinding).toBeDefined();
    expect(efFinding!.severity).toBe('critical');
    expect(efFinding!.pointsDeducted).toBe(25);

    // High-interest debt: 5000 / (3700 * 2) = 0.676 → round(20 * 0.676) = 14 pts
    const hidFinding = assessment.findings.find((f) => f.category === 'high_interest_debt');
    expect(hidFinding).toBeDefined();
    expect(hidFinding!.pointsDeducted).toBe(14);

    // SGLI gap: 2 dependents, 100K coverage → 15 pts
    const sgliFinding = assessment.findings.find((f) => f.category === 'sgli_coverage');
    expect(sgliFinding).toBeDefined();
    expect(sgliFinding!.severity).toBe('critical');
    expect(sgliFinding!.pointsDeducted).toBe(15);

    // Total: 25 + 14 + 15 = 54 → score = 46
    expect(assessment.overallScore).toBe(46);
  });

  it('scores O4 with healthy finances as green (no findings)', () => {
    const state = makeState({
      income: { basePay: 7500, bah: 2400, bas: 400 },
      assets: { savingsBalance: 25000, checkingBalance: 5000 },
      expenses: { housing: 2000, utilities: 200, transportation: 400, food: 600 },
      military: { payGrade: 'O4' as PayGrade, dependents: 3, yearsOfService: 12 },
      deductions: { sgliCoverage: 500000 },
      debts: [],
    });

    const assessment = calculateRiskScore(state);

    expect(assessment.tier).toBe('green');
    expect(assessment.overallScore).toBe(100);
    expect(assessment.findings).toHaveLength(0);
  });

  it('scores partial data (savings + income + minimal expenses) with emergency fund finding only', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 500, checkingBalance: 200 },
      expenses: { housing: 1000, food: 300 },
      military: { dependents: 0 },
      deductions: { sgliCoverage: 0 },
      debts: [],
    });

    const assessment = calculateRiskScore(state);

    // totalLiquid = 700, totalEssential = 1300
    // emergencyFundMonths = 700/1300 ≈ 0.538 → critical, 25 pts
    expect(assessment.findings).toHaveLength(1);
    expect(assessment.findings[0].category).toBe('emergency_fund');
    expect(assessment.findings[0].severity).toBe('critical');
    expect(assessment.overallScore).toBe(75);
    expect(assessment.tier).toBe('yellow');
  });

  it('handles zero income gracefully', () => {
    const state = makeState({
      income: { basePay: 0 },
      assets: { savingsBalance: 500 },
      expenses: { housing: 500 },
      military: { dependents: 1 },
      deductions: { sgliCoverage: 100000 },
      debts: [
        {
          id: '1', name: 'CC', type: 'credit_card',
          balance: 2000, apr: 22, minimumPayment: 100,
          monthlyPayment: 100, preService: false,
        },
      ],
    });

    // Should not throw
    const assessment = calculateRiskScore(state);

    expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    expect(assessment.overallScore).toBeLessThanOrEqual(100);
    expect(assessment.tier).toBeDefined();

    // High-interest debt with zero income → full 20 pts deducted
    const hidFinding = assessment.findings.find((f) => f.category === 'high_interest_debt');
    expect(hidFinding).toBeDefined();
    expect(hidFinding!.pointsDeducted).toBe(20);
  });

  it('deducts 0 points for high-interest debt when there are no debts', () => {
    const state = makeState({
      income: { basePay: 4000, bah: 1500 },
      assets: { savingsBalance: 10000, checkingBalance: 2000 },
      expenses: { housing: 1500, food: 400 },
      military: { dependents: 0 },
      debts: [],
    });

    const assessment = calculateRiskScore(state);

    // No high-interest debt finding
    const hidFinding = assessment.findings.find((f) => f.category === 'high_interest_debt');
    expect(hidFinding).toBeUndefined();

    // 12000 / 1900 = 6.3 months → no emergency fund finding either
    expect(assessment.findings).toHaveLength(0);
    expect(assessment.overallScore).toBe(100);
    expect(assessment.tier).toBe('green');
  });

  it('handles default empty state without crashing', () => {
    const state = makeState();
    const assessment = calculateRiskScore(state);

    // All rules should skip gracefully
    expect(assessment.overallScore).toBe(100);
    expect(assessment.findings).toHaveLength(0);
    expect(assessment.tier).toBe('green');
  });

  it('returns valid generatedAt ISO string and dataQuality', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1500 },
      military: { payGrade: 'E5' as PayGrade, dependents: 2, dutyStation: '92101' },
      assets: { checkingBalance: 500, savingsBalance: 2000 },
      deductions: { tspTraditional: 150, sgliCoverage: 500000 },
      expenses: { housing: 1200, utilities: 150, transportation: 300, food: 400 },
    });

    const assessment = calculateRiskScore(state);

    expect(assessment.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(assessment.dataQuality).toBeGreaterThanOrEqual(0);
    expect(assessment.dataQuality).toBeLessThanOrEqual(1);
  });

  it('scales emergency fund warning proportionally between 1 and 3 months', () => {
    // 2 months of expenses covered → warning, ~13 pts
    const state = makeState({
      income: { basePay: 3000 },
      assets: { savingsBalance: 4000 },
      expenses: { housing: 1500, food: 500 },
      military: { dependents: 0 },
    });

    const assessment = calculateRiskScore(state);

    // totalLiquid = 4000, totalEssential = 2000, months = 2.0
    // pts = round(25 * (3 - 2) / 2) = round(12.5) = 13
    const efFinding = assessment.findings.find((f) => f.category === 'emergency_fund');
    expect(efFinding).toBeDefined();
    expect(efFinding!.severity).toBe('warning');
    expect(efFinding!.pointsDeducted).toBe(13);
    expect(assessment.overallScore).toBe(87);
    expect(assessment.tier).toBe('green');
  });

  it('caps high-interest debt deduction at 20 points', () => {
    // Massive debt relative to income
    const state = makeState({
      income: { basePay: 2000 },
      assets: { savingsBalance: 10000 },
      expenses: { housing: 1000, food: 300 },
      military: { dependents: 0 },
      debts: [
        {
          id: '1', name: 'CC', type: 'credit_card',
          balance: 50000, apr: 25, minimumPayment: 500,
          monthlyPayment: 500, preService: false,
        },
      ],
    });

    const assessment = calculateRiskScore(state);

    const hidFinding = assessment.findings.find((f) => f.category === 'high_interest_debt');
    expect(hidFinding).toBeDefined();
    expect(hidFinding!.pointsDeducted).toBe(20);
    expect(hidFinding!.severity).toBe('critical');
  });

  it('sorts findings by pointsDeducted descending', () => {
    const state = makeState({
      income: { basePay: 2400, bah: 900, bas: 400 },
      assets: { savingsBalance: 200 },
      expenses: { housing: 900, utilities: 100, transportation: 200, food: 400 },
      military: { dependents: 2 },
      deductions: { sgliCoverage: 100000 },
      debts: [
        {
          id: '1', name: 'CC', type: 'credit_card',
          balance: 5000, apr: 22, minimumPayment: 150,
          monthlyPayment: 150, preService: false,
        },
      ],
    });

    const assessment = calculateRiskScore(state);

    for (let i = 1; i < assessment.findings.length; i++) {
      expect(assessment.findings[i - 1].pointsDeducted)
        .toBeGreaterThanOrEqual(assessment.findings[i].pointsDeducted);
    }
  });

  it('includes descriptive text with dollar amounts in findings', () => {
    const state = makeState({
      income: { basePay: 2400, bah: 900, bas: 400 },
      assets: { savingsBalance: 200 },
      expenses: { housing: 900, utilities: 100, transportation: 200, food: 400 },
      military: { dependents: 2 },
      deductions: { sgliCoverage: 100000 },
      debts: [
        {
          id: '1', name: 'CC', type: 'credit_card',
          balance: 5000, apr: 22, minimumPayment: 150,
          monthlyPayment: 150, preService: false,
        },
      ],
    });

    const assessment = calculateRiskScore(state);

    for (const finding of assessment.findings) {
      expect(finding.title.length).toBeGreaterThan(0);
      expect(finding.description.length).toBeGreaterThan(0);
      expect(finding.impact.length).toBeGreaterThan(0);
      // Dollar amounts appear in description or impact
      const combined = finding.description + finding.impact;
      expect(combined).toMatch(/\$/);
    }
  });
});
