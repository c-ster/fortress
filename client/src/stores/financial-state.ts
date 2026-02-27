import { create } from 'zustand';
import type { FinancialState, Debt, Allotment, PayGrade } from '@fortress/types';

function defaultState(): FinancialState {
  return {
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
      payGrade: 'E1' as PayGrade, yearsOfService: 0, dependents: 0,
      dutyStation: '', component: 'active', retirementSystem: 'brs',
      scraEligible: false,
    },
    risk: {
      emergencyFundMonths: 0, debtToIncomeRatio: 0, highInterestDebtTotal: 0,
      sgliAdequate: true, tspMatchCaptured: false, scraOpportunity: 0,
      paydaySpikeSeverity: 0,
    },
    meta: {
      dataSource: 'manual', lastUpdated: new Date().toISOString(),
      completeness: 0, confidenceScores: {},
    },
    actionStatuses: {},
  };
}

export function computeDerived(state: FinancialState): FinancialState {
  const { income, deductions, expenses, debts, assets, military } = state;

  // Income computations
  income.totalGross =
    income.basePay + income.bah + income.bas + income.cola +
    income.specialPay + income.otherIncome;
  income.totalTaxable = income.basePay + income.specialPay + income.otherIncome;
  income.totalNonTaxable = income.bah + income.bas + income.cola;

  // Expense computations
  expenses.totalEssential =
    expenses.housing + expenses.utilities + expenses.transportation +
    expenses.food + expenses.childcare + expenses.insurance;
  expenses.totalMonthly = expenses.totalEssential + expenses.subscriptions + expenses.discretionary;

  // Assets
  assets.totalLiquid = assets.checkingBalance + assets.savingsBalance;

  // Deduction computations
  deductions.tspContributionPct =
    income.basePay > 0
      ? (deductions.tspTraditional + deductions.tspRoth) / income.basePay
      : 0;

  // Risk computations
  state.risk.emergencyFundMonths =
    expenses.totalEssential > 0 ? assets.totalLiquid / expenses.totalEssential : 0;

  const totalDebtPayments = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  state.risk.debtToIncomeRatio =
    income.totalGross > 0 ? totalDebtPayments / income.totalGross : 0;

  state.risk.highInterestDebtTotal = debts
    .filter((d) => d.apr > 15)
    .reduce((sum, d) => sum + d.balance, 0);

  state.risk.sgliAdequate =
    military.dependents === 0 || deductions.sgliCoverage >= 500000;

  state.risk.tspMatchCaptured =
    military.retirementSystem !== 'brs' || deductions.tspContributionPct >= 0.05;

  state.risk.scraOpportunity = debts
    .filter((d) => d.preService && d.apr > 6)
    .reduce((sum, d) => sum + (d.balance * (d.apr / 100 - 0.06)) / 12, 0);

  military.scraEligible = debts.some((d) => d.preService && d.apr > 6);

  // Completeness
  state.meta.completeness = calculateCompleteness(state);
  state.meta.lastUpdated = new Date().toISOString();

  return state;
}

function calculateCompleteness(state: FinancialState): number {
  const checks = [
    state.income.basePay > 0,
    state.military.payGrade !== 'E1' || state.income.basePay > 0,
    state.military.dependents >= 0,
    state.assets.checkingBalance > 0 || state.assets.savingsBalance > 0,
    state.deductions.tspTraditional > 0 || state.deductions.tspRoth > 0 ||
      state.deductions.tspContributionPct === 0,
    state.expenses.totalEssential > 0,
    state.income.bah > 0 || state.expenses.housing > 0,
    state.debts.length > 0 || state.risk.highInterestDebtTotal === 0,
    state.deductions.sgliCoverage > 0,
    state.military.dutyStation !== '',
  ];
  return checks.filter(Boolean).length / checks.length;
}

interface FinancialStateStore {
  state: FinancialState;
  setIncome: (income: Partial<FinancialState['income']>) => void;
  setDeductions: (deductions: Partial<FinancialState['deductions']>) => void;
  setExpenses: (expenses: Partial<FinancialState['expenses']>) => void;
  setAssets: (assets: Partial<FinancialState['assets']>) => void;
  setMilitary: (military: Partial<FinancialState['military']>) => void;
  addDebt: (debt: Debt) => void;
  removeDebt: (id: string) => void;
  updateDebt: (id: string, updates: Partial<Debt>) => void;
  addAllotment: (allotment: Allotment) => void;
  removeAllotment: (id: string) => void;
  setPaydaySpikeSeverity: (severity: number) => void;
  setActionStatus: (actionId: string, status: 'pending' | 'completed' | 'skipped' | 'deferred') => void;
  hydrate: (state: FinancialState) => void;
  reset: () => void;
}

export const useFinancialStore = create<FinancialStateStore>((set) => ({
  state: computeDerived(defaultState()),

  setIncome: (income) =>
    set((store) => ({
      state: computeDerived({ ...store.state, income: { ...store.state.income, ...income } }),
    })),

  setDeductions: (deductions) =>
    set((store) => ({
      state: computeDerived({
        ...store.state,
        deductions: { ...store.state.deductions, ...deductions },
      }),
    })),

  setExpenses: (expenses) =>
    set((store) => ({
      state: computeDerived({
        ...store.state,
        expenses: { ...store.state.expenses, ...expenses },
      }),
    })),

  setAssets: (assets) =>
    set((store) => ({
      state: computeDerived({
        ...store.state,
        assets: { ...store.state.assets, ...assets },
      }),
    })),

  setMilitary: (military) =>
    set((store) => ({
      state: computeDerived({
        ...store.state,
        military: { ...store.state.military, ...military },
      }),
    })),

  addDebt: (debt) =>
    set((store) => ({
      state: computeDerived({ ...store.state, debts: [...store.state.debts, debt] }),
    })),

  removeDebt: (id) =>
    set((store) => ({
      state: computeDerived({
        ...store.state,
        debts: store.state.debts.filter((d) => d.id !== id),
      }),
    })),

  updateDebt: (id, updates) =>
    set((store) => ({
      state: computeDerived({
        ...store.state,
        debts: store.state.debts.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      }),
    })),

  addAllotment: (allotment) =>
    set((store) => ({
      state: computeDerived({
        ...store.state,
        deductions: {
          ...store.state.deductions,
          allotments: [...store.state.deductions.allotments, allotment],
        },
      }),
    })),

  removeAllotment: (id) =>
    set((store) => ({
      state: computeDerived({
        ...store.state,
        deductions: {
          ...store.state.deductions,
          allotments: store.state.deductions.allotments.filter((a) => a.id !== id),
        },
      }),
    })),

  setPaydaySpikeSeverity: (severity) =>
    set((store) => ({
      state: computeDerived({
        ...store.state,
        risk: { ...store.state.risk, paydaySpikeSeverity: severity },
      }),
    })),

  setActionStatus: (actionId, status) =>
    set((store) => ({
      state: computeDerived({
        ...store.state,
        actionStatuses: { ...store.state.actionStatuses, [actionId]: status },
      }),
    })),

  hydrate: (newState) => set({ state: computeDerived(newState) }),

  reset: () => set({ state: computeDerived(defaultState()) }),
}));
