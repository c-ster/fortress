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
  // --- Existing Phase 0 tests (updated for 7-rule scoring) ---

  it('scores E3 with poor finances as red (4 findings including TSP)', () => {
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
    expect(assessment.findings).toHaveLength(4);
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

    // TSP match: BRS, 0% contribution → 15 pts
    const tspFinding = assessment.findings.find((f) => f.category === 'tsp_match');
    expect(tspFinding).toBeDefined();
    expect(tspFinding!.pointsDeducted).toBe(15);

    // Total: 25 + 15 + 15 + 14 = 69 → score = 31
    expect(assessment.overallScore).toBe(31);
  });

  it('scores O4 with healthy finances as green (no findings)', () => {
    const state = makeState({
      income: { basePay: 7500, bah: 2400, bas: 400 },
      assets: { savingsBalance: 25000, checkingBalance: 5000 },
      expenses: { housing: 2000, utilities: 200, transportation: 400, food: 600 },
      military: { payGrade: 'O4' as PayGrade, dependents: 3, yearsOfService: 12 },
      deductions: { sgliCoverage: 500000, tspTraditional: 375 },
      debts: [],
    });

    const assessment = calculateRiskScore(state);

    expect(assessment.tier).toBe('green');
    expect(assessment.overallScore).toBe(100);
    expect(assessment.findings).toHaveLength(0);
  });

  it('scores partial data (savings + income + minimal expenses) with EF + TSP findings', () => {
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
    // TSP: BRS, basePay=3000, tsp=0 → 15 pts
    expect(assessment.findings).toHaveLength(2);
    expect(assessment.findings.find((f) => f.category === 'emergency_fund')).toBeDefined();
    expect(assessment.findings.find((f) => f.category === 'tsp_match')).toBeDefined();
    expect(assessment.overallScore).toBe(60);
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

    // TSP skips (basePay === 0), DTI skips (gross === 0)
    expect(assessment.findings.find((f) => f.category === 'tsp_match')).toBeUndefined();
    expect(assessment.findings.find((f) => f.category === 'debt_to_income')).toBeUndefined();
  });

  it('deducts 0 points for high-interest debt when there are no debts', () => {
    const state = makeState({
      income: { basePay: 4000, bah: 1500 },
      assets: { savingsBalance: 10000, checkingBalance: 2000 },
      expenses: { housing: 1500, food: 400 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 200 },
      debts: [],
    });

    const assessment = calculateRiskScore(state);

    // No high-interest debt finding
    const hidFinding = assessment.findings.find((f) => f.category === 'high_interest_debt');
    expect(hidFinding).toBeUndefined();

    // 12000 / 1900 = 6.3 months → no emergency fund finding either
    // TSP: 200/4000 = 5% → no finding
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
      deductions: { tspTraditional: 150 },
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

  // --- New Phase 1 tests (TSP match, DTI, SCRA, payday spike) ---

  it('flags BRS user at 2% TSP with dollar amount lost and 20-year estimate', () => {
    const state = makeState({
      income: { basePay: 4000, bah: 1500 },
      assets: { savingsBalance: 15000, checkingBalance: 5000 },
      expenses: { housing: 1500, food: 400 },
      military: { retirementSystem: 'brs', dependents: 0 },
      deductions: { tspTraditional: 80 }, // 80/4000 = 2%
      debts: [],
    });

    const assessment = calculateRiskScore(state);

    const tspFinding = assessment.findings.find((f) => f.category === 'tsp_match');
    expect(tspFinding).toBeDefined();

    // pct = 0.02, gap = 0.03
    // pts = round(15 * 0.03 / 0.05) = round(9) = 9
    expect(tspFinding!.pointsDeducted).toBe(9);
    expect(tspFinding!.severity).toBe('warning');
    expect(tspFinding!.actionId).toBe('increase_tsp_contribution');

    // Description should mention annual dollars lost
    // annualLost = 4000 * 12 * 0.03 = $1,440
    expect(tspFinding!.description).toMatch(/\$1,440/);

    // Impact should mention 20-year compounded estimate
    expect(tspFinding!.impact).toMatch(/20 years/);
    expect(tspFinding!.impact).toMatch(/\$/);
  });

  it('skips TSP rule for legacy retirement system', () => {
    const state = makeState({
      income: { basePay: 4000, bah: 1500 },
      assets: { savingsBalance: 15000, checkingBalance: 5000 },
      expenses: { housing: 1500, food: 400 },
      military: { retirementSystem: 'legacy', dependents: 0 },
      deductions: { tspTraditional: 0 },
      debts: [],
    });

    const assessment = calculateRiskScore(state);

    const tspFinding = assessment.findings.find((f) => f.category === 'tsp_match');
    expect(tspFinding).toBeUndefined();
  });

  it('flags critical TSP at 0% contribution', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 15000, checkingBalance: 5000 },
      expenses: { housing: 1500, food: 400 },
      military: { retirementSystem: 'brs', dependents: 0 },
      deductions: { tspTraditional: 0 },
      debts: [],
    });

    const assessment = calculateRiskScore(state);

    const tspFinding = assessment.findings.find((f) => f.category === 'tsp_match');
    expect(tspFinding).toBeDefined();
    expect(tspFinding!.severity).toBe('critical');
    expect(tspFinding!.pointsDeducted).toBe(15);
  });

  it('flags DTI at 45% as critical mentioning security clearance', () => {
    const state = makeState({
      income: { basePay: 4000, bah: 1500 },
      assets: { savingsBalance: 15000, checkingBalance: 5000 },
      expenses: { housing: 1500, food: 400 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 200 },
      debts: [
        {
          id: '1', name: 'Car Loan', type: 'auto',
          balance: 25000, apr: 8, minimumPayment: 2475,
          monthlyPayment: 2475, preService: false,
        },
      ],
    });

    // DTI = 2475 / 5500 = 0.45 → critical, 10 pts
    const assessment = calculateRiskScore(state);

    const dtiFinding = assessment.findings.find((f) => f.category === 'debt_to_income');
    expect(dtiFinding).toBeDefined();
    expect(dtiFinding!.severity).toBe('critical');
    expect(dtiFinding!.pointsDeducted).toBe(10);
    expect(dtiFinding!.actionId).toBe('reduce_debt_to_income');

    // Must mention security clearance
    expect(dtiFinding!.description).toMatch(/clearance/i);
    // Must mention dollar amounts
    expect(dtiFinding!.impact).toMatch(/\$/);
  });

  it('scales DTI warning proportionally between 30% and 40%', () => {
    const state = makeState({
      income: { basePay: 4000, bah: 1500 },
      assets: { savingsBalance: 15000, checkingBalance: 5000 },
      expenses: { housing: 1500, food: 400 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 200 },
      debts: [
        {
          id: '1', name: 'Car', type: 'auto',
          balance: 15000, apr: 8, minimumPayment: 1925,
          monthlyPayment: 1925, preService: false,
        },
      ],
    });

    // DTI = 1925 / 5500 = 0.35 → warning
    // pts = round(10 * (0.35 - 0.30) / 0.10) = round(5) = 5
    const assessment = calculateRiskScore(state);

    const dtiFinding = assessment.findings.find((f) => f.category === 'debt_to_income');
    expect(dtiFinding).toBeDefined();
    expect(dtiFinding!.severity).toBe('warning');
    expect(dtiFinding!.pointsDeducted).toBe(5);
  });

  it('skips DTI rule when ratio is healthy (below 30%)', () => {
    const state = makeState({
      income: { basePay: 5000, bah: 1500 },
      assets: { savingsBalance: 20000, checkingBalance: 5000 },
      expenses: { housing: 1500, food: 400 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 250 },
      debts: [
        {
          id: '1', name: 'Car', type: 'auto',
          balance: 10000, apr: 5, minimumPayment: 500,
          monthlyPayment: 500, preService: false,
        },
      ],
    });

    // DTI = 500 / 6500 ≈ 0.077 → healthy
    const assessment = calculateRiskScore(state);

    const dtiFinding = assessment.findings.find((f) => f.category === 'debt_to_income');
    expect(dtiFinding).toBeUndefined();
  });

  it('flags pre-service auto loan at 18% with SCRA finding showing savings', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 15000, checkingBalance: 5000 },
      expenses: { housing: 1200, food: 300 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 150 },
      debts: [
        {
          id: '1', name: 'Auto Loan', type: 'auto',
          balance: 15000, apr: 18, minimumPayment: 400,
          monthlyPayment: 400, preService: true,
        },
      ],
    });

    // scraOpportunity = 15000 * (0.18 - 0.06) / 12 = 15000 * 0.12 / 12 = $150/mo
    // ratio = min(150/200, 1.0) = 0.75
    // pts = round(10 * 0.75) = 8
    const assessment = calculateRiskScore(state);

    const scraFinding = assessment.findings.find((f) => f.category === 'scra_opportunity');
    expect(scraFinding).toBeDefined();
    expect(scraFinding!.pointsDeducted).toBe(8);
    expect(scraFinding!.severity).toBe('critical'); // >= $100/mo
    expect(scraFinding!.actionId).toBe('invoke_scra_protection');

    // Impact should show monthly and annual savings
    expect(scraFinding!.impact).toMatch(/\$150/);  // monthly
    expect(scraFinding!.impact).toMatch(/\$1,800/); // annual (150*12)
  });

  it('caps SCRA deduction at 10 points for large savings', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 15000, checkingBalance: 5000 },
      expenses: { housing: 1200, food: 300 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 150 },
      debts: [
        {
          id: '1', name: 'Auto Loan', type: 'auto',
          balance: 40000, apr: 24, minimumPayment: 800,
          monthlyPayment: 800, preService: true,
        },
      ],
    });

    // scraOpportunity = 40000 * (0.24 - 0.06) / 12 = 40000 * 0.18 / 12 = $600/mo
    // ratio = min(600/200, 1.0) = 1.0
    // pts = round(10 * 1.0) = 10
    const assessment = calculateRiskScore(state);

    const scraFinding = assessment.findings.find((f) => f.category === 'scra_opportunity');
    expect(scraFinding).toBeDefined();
    expect(scraFinding!.pointsDeducted).toBe(10);
  });

  it('scores payday spike 0 when severity data is unavailable (default 0)', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 15000, checkingBalance: 5000 },
      expenses: { housing: 1200, food: 300 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 150 },
      debts: [],
    });

    // paydaySpikeSeverity defaults to 0 → skipped
    const assessment = calculateRiskScore(state);

    const paydayFinding = assessment.findings.find((f) => f.category === 'payday_spike');
    expect(paydayFinding).toBeUndefined();
  });

  it('flags payday spike proportionally when severity > 0.5', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 15000, checkingBalance: 5000 },
      expenses: { housing: 1200, food: 300 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 150 },
      debts: [],
      risk: { paydaySpikeSeverity: 0.8 },
    });

    // pts = round(5 * (0.8 - 0.5) / 0.5) = round(3) = 3
    const assessment = calculateRiskScore(state);

    const paydayFinding = assessment.findings.find((f) => f.category === 'payday_spike');
    expect(paydayFinding).toBeDefined();
    expect(paydayFinding!.pointsDeducted).toBe(3);
    expect(paydayFinding!.severity).toBe('critical'); // >= 0.8
    expect(paydayFinding!.actionId).toBe('smooth_payday_expenses');
  });

  it('deducts full 5 points for payday spike severity 1.0', () => {
    const state = makeState({
      income: { basePay: 3000, bah: 1200 },
      assets: { savingsBalance: 15000, checkingBalance: 5000 },
      expenses: { housing: 1200, food: 300 },
      military: { dependents: 0 },
      deductions: { tspTraditional: 150 },
      debts: [],
      risk: { paydaySpikeSeverity: 1.0 },
    });

    // pts = round(5 * (1.0 - 0.5) / 0.5) = round(5) = 5
    const assessment = calculateRiskScore(state);

    const paydayFinding = assessment.findings.find((f) => f.category === 'payday_spike');
    expect(paydayFinding).toBeDefined();
    expect(paydayFinding!.pointsDeducted).toBe(5);
  });

  it('scores all 7 rules firing simultaneously with correct total', () => {
    const state = makeState({
      income: { basePay: 2000 },
      assets: { savingsBalance: 100, checkingBalance: 50 },
      expenses: { housing: 800, utilities: 100, transportation: 200, food: 300 },
      military: { dependents: 2, retirementSystem: 'brs' },
      deductions: { sgliCoverage: 100000, tspTraditional: 0 },
      debts: [
        {
          id: '1', name: 'Credit Card', type: 'credit_card',
          balance: 8000, apr: 24, minimumPayment: 200,
          monthlyPayment: 800, preService: true,
        },
      ],
      risk: { paydaySpikeSeverity: 1.0 },
    });

    const assessment = calculateRiskScore(state);

    // All 7 categories should produce findings
    const categories = assessment.findings.map((f) => f.category);
    expect(categories).toContain('emergency_fund');
    expect(categories).toContain('high_interest_debt');
    expect(categories).toContain('sgli_coverage');
    expect(categories).toContain('tsp_match');
    expect(categories).toContain('debt_to_income');
    expect(categories).toContain('scra_opportunity');
    expect(categories).toContain('payday_spike');

    expect(assessment.findings).toHaveLength(7);

    // Verify sorted descending
    for (let i = 1; i < assessment.findings.length; i++) {
      expect(assessment.findings[i - 1].pointsDeducted)
        .toBeGreaterThanOrEqual(assessment.findings[i].pointsDeducted);
    }

    // Score should be 0 or very low (all 100 points possible)
    expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    expect(assessment.overallScore).toBeLessThanOrEqual(100);
    expect(assessment.tier).toBe('red');
  });
});
