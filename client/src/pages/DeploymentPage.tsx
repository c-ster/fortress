/**
 * Deployment Prep Planner page.
 *
 * Two-column layout: input form (left) + results & action list (right).
 * Wires useDeployment hook to DeploymentInputForm, DeploymentResults,
 * and DeploymentActionList.
 */

import { Link } from 'react-router-dom';
import { useFinancialStore } from '../stores/financial-state';
import { useDeployment } from '../hooks/useDeployment';
import { DeploymentInputForm } from '../components/deployment/DeploymentInputForm';
import { DeploymentResults } from '../components/deployment/DeploymentResults';
import { DeploymentActionList } from '../components/deployment/DeploymentActionList';

export function DeploymentPage() {
  const financialState = useFinancialStore((s) => s.state);
  const { input, plan, updateInput } = useDeployment(financialState);

  const hasData = financialState.meta.completeness > 0.2;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-fortress-navy">Deployment Prep Planner</h2>
        <p className="text-gray-500 mt-1">
          Prepare your finances for deployment — budget impact, auto-pay audit, and spousal handover.
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
              Complete your financial intake for more accurate deployment estimates.
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
          <DeploymentInputForm
            input={input}
            onUpdate={updateInput}
            payGrade={financialState.military.payGrade}
            dependents={financialState.military.dependents}
          />
        </div>

        {/* Right: results + actions */}
        <div className="lg:col-span-2 space-y-4">
          <DeploymentResults plan={plan} />
          <DeploymentActionList actions={plan.actions} />
        </div>
      </div>
    </div>
  );
}
