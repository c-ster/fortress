/**
 * Deployment preparation module types.
 * Models inputs, budget impact, bill audit, actions, and the full deployment plan
 * for military combat/overseas deployment financial preparation.
 *
 * OPSEC: No specific dates or locations — relative timeframes only (§7.2).
 */

// ────────────────────────────────────────────────────────────
// Inputs
// ────────────────────────────────────────────────────────────

/** Relative deployment duration — no specific dates stored. */
export type DeploymentLength = 'short' | 'medium' | 'long';

export interface DeploymentInput {
  deploymentLength: DeploymentLength;  // <3mo | 3–6mo | >6mo
  hasSpouse: boolean;
  spouseMonthlyIncome: number;         // Current or expected spouse income
  reducedExpenses: number;             // User estimate of monthly expense savings
}

// ────────────────────────────────────────────────────────────
// Budget Impact
// ────────────────────────────────────────────────────────────

export interface DeploymentBudgetImpact {
  currentMonthlyNet: number;           // Pre-deployment net cash flow
  deploymentMonthlyNet: number;        // During-deployment net cash flow
  monthlyDelta: number;                // Change in monthly cash flow
  deploymentMonths: number;            // 3 | 6 | 12
  totalImpact: number;                // monthlyDelta × deploymentMonths
  recommendedBuffer: number;           // Emergency fund target
  currentBuffer: number;               // Existing emergency fund
  bufferGap: number;                   // max(0, recommended − current)
}

// ────────────────────────────────────────────────────────────
// Bill Audit
// ────────────────────────────────────────────────────────────

export interface BillAuditItem {
  category: string;
  label: string;
  monthlyAmount: number;
  priority: 'critical' | 'important' | 'optional';
  recommendation: string;
}

// ────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────

export interface DeploymentAction {
  id: string;
  title: string;
  description: string;
  mechanism: string;
  tier: 'immediate' | 'stabilization';
  difficulty: 'easy' | 'medium';
  estimatedMinutes: number;
}

// ────────────────────────────────────────────────────────────
// Full Plan
// ────────────────────────────────────────────────────────────

export interface DeploymentPlan {
  budgetImpact: DeploymentBudgetImpact;
  billAudit: BillAuditItem[];
  actions: DeploymentAction[];
  spousalSummary: string;              // Plain-text handover for spouse
  recommendation: string;              // Overall advice
}
