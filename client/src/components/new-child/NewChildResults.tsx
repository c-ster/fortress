/**
 * New child results display.
 * Shows BAH impact, monthly budget, emergency fund, tax benefits,
 * and a recommendation.
 */

import type { NewChildPlan } from '@fortress/types';

interface NewChildResultsProps {
  plan: NewChildPlan;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold text-fortress-slate' : 'text-fortress-slate'}`}>
        {value}
      </span>
    </div>
  );
}

export function NewChildResults({ plan }: NewChildResultsProps) {
  const { bahImpact: bah, budgetImpact: budget, emergencyFund: emg, taxBenefits: tax } = plan;
  const deltaColor = budget.netMonthlyDelta >= 0 ? 'text-fortress-green' : 'text-fortress-red';
  const deltaSign = budget.netMonthlyDelta >= 0 ? '+' : '';

  return (
    <div className="space-y-4">
      {/* BAH Impact */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-4 uppercase tracking-wider">
          BAH Impact
        </h3>

        {bah.firstChild ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-400">Current BAH (w/o dep)</p>
                <p className="text-lg font-bold text-fortress-slate tabular-nums">
                  {fmt(bah.currentRate)}/mo
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">New BAH (w/ dep)</p>
                <p className="text-lg font-bold text-fortress-slate tabular-nums">
                  {fmt(bah.newRate)}/mo
                </p>
              </div>
            </div>
            <div className="text-center p-3 rounded-md bg-green-50">
              <p className="text-xl font-bold tabular-nums text-fortress-green">
                +{fmt(bah.monthlyDelta)}/mo
              </p>
              <p className="text-xs text-gray-500 mt-1">First dependent BAH increase</p>
            </div>
          </>
        ) : (
          <div className="text-center p-3 rounded-md bg-gray-50">
            <p className="text-sm font-medium text-gray-500">No BAH Change</p>
            <p className="text-xs text-gray-400 mt-1">
              You already receive the &ldquo;with dependents&rdquo; rate ({fmt(bah.currentRate)}/mo)
            </p>
          </div>
        )}
      </div>

      {/* Monthly Budget Impact */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-4 uppercase tracking-wider">
          Monthly Budget Impact
        </h3>

        <div className="space-y-1.5 mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">New Expenses</p>
          <Row label="Additional Childcare" value={`${fmt(budget.additionalChildcare)}/mo`} />
          <Row label="Supplies & Gear" value={`${fmt(budget.suppliesCost)}/mo`} />
          {budget.fsgliFee > 0 && (
            <Row label="FSGLI Premium" value={`${fmt(budget.fsgliFee)}/mo`} />
          )}
          <Row label="Total New Expenses" value={`${fmt(budget.totalNewExpenses)}/mo`} bold />
        </div>

        <div className="space-y-1.5 mb-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Offsets</p>
          {budget.bahIncrease > 0 && (
            <Row label="BAH Increase" value={`+${fmt(budget.bahIncrease)}/mo`} />
          )}
          {budget.depCareSavings > 0 && (
            <Row label="Dep Care FSA Savings" value={`+${fmt(budget.depCareSavings)}/mo`} />
          )}
        </div>

        <div className={`text-center p-3 rounded-md ${budget.netMonthlyDelta >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className={`text-xl font-bold tabular-nums ${deltaColor}`}>
            {deltaSign}{fmt(budget.netMonthlyDelta)}/mo
          </p>
          <p className="text-xs text-gray-500 mt-1">Net monthly impact</p>
        </div>
      </div>

      {/* Emergency Fund */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wider">
          Emergency Fund Check
        </h3>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Coverage</span>
          <span className="font-medium text-fortress-slate tabular-nums">
            {emg.monthsCovered.toFixed(1)} months of {fmt(Math.round(emg.monthlyExpensesAfter))}/mo
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${emg.gap === 0 ? 'bg-fortress-green' : 'bg-fortress-yellow'}`}
            style={{ width: `${Math.min(100, emg.recommended > 0 ? ((emg.recommended - emg.gap) / emg.recommended) * 100 : 100)}%` }}
          />
        </div>
        {emg.gap > 0 ? (
          <p className="text-xs text-fortress-red mt-1">
            Gap: {fmt(emg.gap)} needed to reach 3-month buffer ({fmt(emg.recommended)})
          </p>
        ) : (
          <p className="text-xs text-fortress-green mt-1">
            Emergency fund meets the 3-month buffer for post-child expenses
          </p>
        )}
      </div>

      {/* Tax Benefits */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wider">
          Tax Benefits
        </h3>
        <div className="space-y-1.5">
          <Row label="Child Tax Credit" value={`${fmt(tax.childTaxCredit)}/yr`} />
          {tax.depCareFSA > 0 && (
            <Row label="Dependent Care FSA Savings" value={`${fmt(tax.depCareFSA)}/yr`} />
          )}
          <Row label="Estimated Annual Savings" value={`${fmt(tax.estimatedAnnualSavings)}/yr`} bold />
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-2">
          Recommendation
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed">{plan.recommendation}</p>
      </div>
    </div>
  );
}
