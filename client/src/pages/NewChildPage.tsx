/**
 * New Child Financial Planner page.
 *
 * Two-column layout: input form (left) + results & actions (right).
 * Wires useNewChild hook (async BAH fetch) to components.
 */

import { Link } from 'react-router-dom';
import { useFinancialStore } from '../stores/financial-state';
import { useNewChild } from '../hooks/useNewChild';
import { NewChildInputForm } from '../components/new-child/NewChildInputForm';
import { NewChildResults } from '../components/new-child/NewChildResults';
import { NewChildActionList } from '../components/new-child/NewChildActionList';

export function NewChildPage() {
  const financialState = useFinancialStore((s) => s.state);
  const { input, plan, updateInput, isLoading } = useNewChild(financialState);

  const hasData = financialState.meta.completeness > 0.2;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-fortress-navy">New Child Planner</h2>
        <p className="text-gray-500 mt-1">
          Plan the financial impact of a new child — BAH changes, budget adjustments,
          tax benefits, and enrollment actions.
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
              Complete your financial intake for more accurate estimates.
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

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400">Loading BAH rates&hellip;</p>
        </div>
      )}

      {/* Two-column layout */}
      {!isLoading && plan && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: inputs */}
          <div className="lg:col-span-1">
            <NewChildInputForm
              input={input}
              onUpdate={updateInput}
              payGrade={financialState.military.payGrade}
              dependents={financialState.military.dependents}
              dutyStation={financialState.military.dutyStation}
            />
          </div>

          {/* Right: results + actions */}
          <div className="lg:col-span-2 space-y-4">
            <NewChildResults plan={plan} />
            <NewChildActionList actions={plan.actions} />
          </div>
        </div>
      )}
    </div>
  );
}
