/**
 * New-child playbook types.
 *
 * Financial impact analysis for military families expecting or welcoming
 * a new child: BAH changes, budget impact, tax benefits, action checklist.
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface NewChildInput {
  expectedMonth: number;           // 1–12 months from now
  currentChildcare: number;        // current monthly childcare cost
  estimatedNewChildcare: number;   // additional monthly childcare for new child
  estimatedSupplies: number;       // diapers, formula, gear — monthly
  planFSGLI: boolean;              // enroll/update spouse FSGLI?
  planDepCare: boolean;            // use Dependent Care FSA?
}

// ---------------------------------------------------------------------------
// Sub-results
// ---------------------------------------------------------------------------

export interface BahImpact {
  currentRate: number;             // current BAH
  newRate: number;                 // BAH after adding dependent
  monthlyDelta: number;            // 0 if already had dependents
  firstChild: boolean;             // true if 0→1 dependent transition
}

export interface MonthlyBudgetImpact {
  additionalChildcare: number;
  suppliesCost: number;
  fsgliFee: number;                // ~$10/mo for spouse FSGLI
  depCareSavings: number;          // FSA tax savings per month
  totalNewExpenses: number;
  bahIncrease: number;
  netMonthlyDelta: number;         // negative = expenses exceed new income
}

export interface EmergencyFundCheck {
  currentFund: number;
  monthlyExpensesAfter: number;    // total monthly expenses post-child
  monthsCovered: number;
  recommended: number;             // 3-month target
  gap: number;
}

export interface TaxBenefits {
  childTaxCredit: number;          // annual
  depCareFSA: number;              // annual FSA tax savings
  estimatedAnnualSavings: number;  // total
}

export type NewChildActionCategory = 'admin' | 'financial' | 'insurance' | 'legal';
export type NewChildTimeframe = 'before_birth' | 'within_30_days' | 'within_90_days';

export interface NewChildAction {
  id: string;
  title: string;
  description: string;
  mechanism: string;
  category: NewChildActionCategory;
  timeframe: NewChildTimeframe;
}

// ---------------------------------------------------------------------------
// Plan (top-level result)
// ---------------------------------------------------------------------------

export interface NewChildPlan {
  bahImpact: BahImpact;
  budgetImpact: MonthlyBudgetImpact;
  emergencyFund: EmergencyFundCheck;
  taxBenefits: TaxBenefits;
  actions: NewChildAction[];
  recommendation: string;
}
