export interface Action {
  id: string;
  riskFindingId: string;
  title: string;
  description: string;
  mechanism: string;
  amount?: number;
  deadline: string;
  estimatedImpact: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
  status: 'pending' | 'completed' | 'skipped' | 'deferred';
}

export interface ActionPlan {
  immediate: Action[];
  stabilization: Action[];
  compounding: Action[];
}
