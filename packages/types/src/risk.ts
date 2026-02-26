export type RiskCategory =
  | 'emergency_fund'
  | 'high_interest_debt'
  | 'sgli_coverage'
  | 'tsp_match'
  | 'debt_to_income'
  | 'scra_opportunity'
  | 'payday_spike';

export interface RiskFinding {
  id: string;
  category: RiskCategory;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  impact: string;
  actionId: string;
  pointsDeducted: number;
  weight: number;
}

export interface RiskAssessment {
  overallScore: number;
  tier: 'green' | 'yellow' | 'red';
  findings: RiskFinding[];
  dataQuality: number;
  generatedAt: string;
}
