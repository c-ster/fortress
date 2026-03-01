/**
 * Transition Planner page.
 *
 * Two-column layout: input form (left) + results, checklist (right).
 * Wires useTransition hook to TransitionInputForm, TransitionResults,
 * and TransitionChecklist.
 */

import { Link } from 'react-router-dom';
import { useFinancialStore } from '../stores/financial-state';
import { useTransition } from '../hooks/useTransition';
import { TransitionInputForm } from '../components/transition/TransitionInputForm';
import { TransitionResults } from '../components/transition/TransitionResults';
import { TransitionChecklist } from '../components/transition/TransitionChecklist';

export function TransitionPage() {
  const financialState = useFinancialStore((s) => s.state);
  const { input, plan, updateInput } = useTransition(financialState);

  const hasData = financialState.meta.completeness > 0.2;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-fortress-navy">Transition Planner</h2>
        <p className="text-gray-500 mt-1">
          Plan your military-to-civilian transition — income projection, benefits, and checklist.
        </p>
      </div>

      {/* Data quality banner */}
      {!hasData && (
        <div className="bg-yellow-50 border border-fortress-yellow/30 rounded-lg p-4 mb-6
          flex items-start gap-3">
          <span className="text-fortress-yellow text-lg">&#9888;</span>
          <div>
            <p className="text-sm font-semibold text-fortress-slate">
              Limited Data Available
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Complete your financial intake for more accurate transition estimates.
            </p>
            <Link
              to="/intake"
              className="text-sm text-fortress-navy font-medium hover:underline mt-2
                inline-block"
            >
              Complete Intake &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: inputs */}
        <div className="lg:col-span-1">
          <TransitionInputForm
            input={input}
            onUpdate={updateInput}
            payGrade={financialState.military.payGrade}
            yearsOfService={financialState.military.yearsOfService}
            dependents={financialState.military.dependents}
            retirementSystem={financialState.military.retirementSystem}
          />
        </div>

        {/* Right: results + checklist */}
        <div className="lg:col-span-2 space-y-4">
          <TransitionResults plan={plan} />
          <TransitionChecklist checklists={plan.checklists} />
        </div>
      </div>
    </div>
  );
}
