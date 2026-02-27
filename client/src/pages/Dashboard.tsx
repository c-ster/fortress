import { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useFinancialStore } from '../stores/financial-state';
import { calculateRiskScore } from '../engine/risk-engine';
import { generateActionPlan, ACTION_PLAN_DISCLAIMER } from '../engine/action-generator';
import { RiskScore } from '../components/dashboard/RiskScore';
import { FindingCard } from '../components/dashboard/FindingCard';
import { ActionCard } from '../components/dashboard/ActionCard';
import type { Action } from '@fortress/types';

function DataQualityBanner({ completeness }: { completeness: number }) {
  return (
    <div className="bg-yellow-50 border border-fortress-yellow/30 rounded-lg p-4 mb-6
      flex items-start gap-3">
      <span className="text-fortress-yellow text-lg">&#9888;</span>
      <div>
        <p className="text-sm font-semibold text-fortress-slate">
          Preliminary Score ({Math.round(completeness * 100)}% data)
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Your risk score may not be fully accurate. Complete your financial intake for a
          comprehensive assessment.
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
  );
}

export function Dashboard() {
  const { state, setActionStatus } = useFinancialStore();
  const assessment = useMemo(() => calculateRiskScore(state), [state]);
  const actionPlan = useMemo(
    () => generateActionPlan(state, assessment),
    [state, assessment],
  );

  const handleStatusChange = useCallback(
    (actionId: string, status: Action['status']) => {
      setActionStatus(actionId, status);
    },
    [setActionStatus],
  );

  // Resolve effective status: overlay persisted statuses onto generated actions
  const allActions = actionPlan.immediate;
  const resolvedActions = allActions.map((action) => ({
    ...action,
    status: state.actionStatuses[action.id] ?? action.status,
  }));
  const activeActions = resolvedActions.filter(
    (a) => a.status === 'pending' || a.status === 'deferred',
  );
  const completedActions = resolvedActions.filter(
    (a) => a.status === 'completed' || a.status === 'skipped',
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-fortress-navy mb-2">
        Financial Readiness Dashboard
      </h2>
      <p className="text-gray-600 mb-6">
        Your personalized risk score based on current financial data.
      </p>

      {assessment.dataQuality < 0.5 && (
        <DataQualityBanner completeness={assessment.dataQuality} />
      )}

      <RiskScore score={assessment.overallScore} tier={assessment.tier} />

      <section className="mt-8">
        <h3 className="text-lg font-semibold text-fortress-navy mb-4">
          Findings{' '}
          <span className="text-sm font-normal text-gray-400">
            ({assessment.findings.length})
          </span>
        </h3>

        {assessment.findings.length === 0 ? (
          <div className="bg-green-50 border border-fortress-green/30 rounded-lg p-6
            text-center">
            <span className="text-fortress-green text-2xl font-bold">&#10003;</span>
            <p className="text-sm text-green-800 mt-2">
              No risk findings — great financial readiness posture!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assessment.findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        )}
      </section>

      {/* Action Plan Section */}
      {allActions.length > 0 && (
        <section className="mt-8">
          <h3 className="text-lg font-semibold text-fortress-navy mb-1">
            Action Plan{' '}
            <span className="text-sm font-normal text-gray-400">
              ({activeActions.length} remaining)
            </span>
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Quick wins to improve your financial readiness this week.
          </p>

          {/* Active actions */}
          <div className="space-y-3">
            {activeActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>

          {/* Completed / Skipped actions */}
          {completedActions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                Completed / Skipped ({completedActions.length})
              </p>
              <div className="space-y-2">
                {completedActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onStatusChange={handleStatusChange}
                    muted
                  />
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer — always visible */}
          <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-xs text-gray-500 leading-relaxed">
              {ACTION_PLAN_DISCLAIMER}
            </p>
          </div>
        </section>
      )}

      <div className="mt-8 flex gap-3">
        <Link
          to="/intake"
          className="border border-fortress-navy text-fortress-navy px-6 py-2.5
            rounded-md text-sm font-medium hover:bg-fortress-navy/10 transition-colors"
        >
          Update Financial Data
        </Link>
      </div>
    </div>
  );
}
