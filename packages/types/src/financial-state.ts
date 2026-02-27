export type PayGrade =
  | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8' | 'E9'
  | 'O1' | 'O1E' | 'O2' | 'O2E' | 'O3' | 'O3E' | 'O4' | 'O5'
  | 'W1' | 'W2' | 'W3' | 'W4' | 'W5';

export interface Debt {
  id: string;
  name: string;
  type: 'credit_card' | 'auto' | 'personal' | 'student' | 'mortgage' | 'other';
  balance: number;
  apr: number;
  minimumPayment: number;
  monthlyPayment: number;
  preService: boolean;
  originalDate?: string;
}

export interface Allotment {
  id: string;
  name: string;
  amount: number;
  destination: 'savings' | 'investment' | 'family' | 'other';
}

export interface FinancialState {
  income: {
    basePay: number;
    bah: number;
    bas: number;
    cola: number;
    specialPay: number;
    otherIncome: number;
    totalGross: number;
    totalTaxable: number;
    totalNonTaxable: number;
  };

  deductions: {
    federalTax: number;
    stateTax: number;
    fica: number;
    sgli: number;
    sgliCoverage: number;
    tspTraditional: number;
    tspRoth: number;
    tspContributionPct: number;
    tricare: number;
    otherDeductions: number;
    allotments: Allotment[];
  };

  expenses: {
    housing: number;
    utilities: number;
    transportation: number;
    food: number;
    childcare: number;
    insurance: number;
    subscriptions: number;
    discretionary: number;
    totalEssential: number;
    totalMonthly: number;
  };

  debts: Debt[];

  assets: {
    checkingBalance: number;
    savingsBalance: number;
    emergencyFund: number;
    tspBalance: number;
    otherInvestments: number;
    totalLiquid: number;
  };

  military: {
    payGrade: PayGrade;
    yearsOfService: number;
    dependents: number;
    dutyStation: string;
    component: 'active' | 'reserve' | 'guard';
    retirementSystem: 'brs' | 'legacy' | 'unknown';
    scraEligible: boolean;
  };

  risk: {
    emergencyFundMonths: number;
    debtToIncomeRatio: number;
    highInterestDebtTotal: number;
    sgliAdequate: boolean;
    tspMatchCaptured: boolean;
    scraOpportunity: number;
    paydaySpikeSeverity: number;
  };

  meta: {
    dataSource: 'les_ocr' | 'manual' | 'hybrid';
    lastUpdated: string;
    completeness: number;
    confidenceScores: Record<string, number>;
  };

  actionStatuses: Record<string, 'pending' | 'completed' | 'skipped' | 'deferred'>;
}
