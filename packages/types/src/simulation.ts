export interface SimulationScenario {
  tspContributionPct: number;
  monthlySavingsAllotment: number;
  debtStrategy: 'minimum' | 'avalanche' | 'snowball';
  extraDebtPayment: number;
  housingChoice: 'on_base' | 'at_bah' | 'below_bah';
  bahDelta: number;
  lifestyleAdjustmentPct: number;
  horizonMonths: number;
  iterations: number;
  tspReturnMean: number;
  tspReturnStdDev: number;
  savingsReturnMean: number;
}

export interface PercentileBand {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface MonthlySnapshot {
  month: number;
  liquidSavings: number;
  tspBalance: number;
  totalDebt: number;
  netWorth: number;
  disposable: number;
  emergencyFundMonths: number;
}

export interface MilestoneEstimate {
  medianMonth: number;
  rangeMonths: [number, number];
  achievedInAllRuns: boolean;
}

export interface SimulationResult {
  projections: {
    month: number;
    liquidSavings: PercentileBand;
    tspBalance: PercentileBand;
    totalDebt: PercentileBand;
    netWorth: PercentileBand;
    emergencyFundMonths: PercentileBand;
  }[];
  milestones: Record<string, MilestoneEstimate | null>;
  comparison?: ComparisonDelta;
}

export interface ComparisonDelta {
  year1: DeltaSnapshot;
  year5: DeltaSnapshot;
  year10: DeltaSnapshot;
  year20: DeltaSnapshot;
  totalInterestSaved: PercentileBand;
  debtFreeMonthsEarlier: PercentileBand;
  additionalTSPAtRetirement: PercentileBand;
}

export interface DeltaSnapshot {
  netWorth: PercentileBand;
  tspBalance: PercentileBand;
  totalDebt: PercentileBand;
  liquidSavings: PercentileBand;
}
