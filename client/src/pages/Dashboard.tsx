import { useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useFinancialStore } from '../stores/financial-state';
import { calculateRiskScore } from '../engine/risk-engine';
import { generateActionPlan, ACTION_PLAN_DISCLAIMER } from '../engine/action-generator';
import {
  isCheckInDue,
  getPendingCheckIn,
  selectQuestions,
  calculateTrajectory,
} from '../engine/check-in-scheduler';
import { RiskScore } from '../components/dashboard/RiskScore';
import { FindingCard } from '../components/dashboard/FindingCard';
import { ActionCard } from '../components/dashboard/ActionCard';
import { CheckInBanner } from '../components/dashboard/CheckInBanner';
import { CheckInCard } from '../components/dashboard/CheckInCard';
import { TrajectoryCard } from '../components/dashboard/TrajectoryCard';
import { CheckInHistory } from '../components/dashboard/CheckInHistory';
import type { Action, CheckIn } from '@fortress/types';

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

function ActionTier({
  title,
  subtitle,
  actions,
  onStatusChange,
}: {
  title: string;
  subtitle: string;
  actions: Action[];
  onStatusChange: (actionId: string, status: Action['status']) => void;
}) {
  const active = actions.filter(
    (a) => a.status === 'pending' || a.status === 'deferred',
  );
  const completed = actions.filter(
    (a) => a.status === 'completed' || a.status === 'skipped',
  );

  return (
    <div className="mb-6">
      <h4 className="text-base font-semibold text-fortress-navy mb-0.5">
        {title}{' '}
        <span className="text-sm font-normal text-gray-400">
          ({active.length} remaining)
        </span>
      </h4>
      <p className="text-sm text-gray-500 mb-3">{subtitle}</p>

      <div className="space-y-3">
        {active.map((action) => (
          <ActionCard
            key={action.id}
            action={action}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>

      {completed.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
            Completed / Skipped ({completed.length})
          </p>
          <div className="space-y-2">
            {completed.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onStatusChange={onStatusChange}
                muted
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { state, setActionStatus, recordCheckIn } = useFinancialStore();
  const checkInRef = useRef<HTMLDivElement>(null);

  const assessment = useMemo(() => calculateRiskScore(state), [state]);
  const actionPlan = useMemo(
    () => generateActionPlan(state, assessment),
    [state, assessment],
  );

  // Check-in state
  const checkInDue = useMemo(() => isCheckInDue(state.checkIns), [state.checkIns]);
  const pendingCheckIn = useMemo(() => getPendingCheckIn(state.checkIns), [state.checkIns]);
  const questions = useMemo(() => selectQuestions(state), [state]);
  const trajectories = useMemo(
    () => calculateTrajectory(state, state.checkIns),
    [state],
  );

  const handleStatusChange = useCallback(
    (actionId: string, status: Action['status']) => {
      setActionStatus(actionId, status);
    },
    [setActionStatus],
  );

  const handleCheckInComplete = useCallback(
    (checkIn: CheckIn) => recordCheckIn(checkIn),
    [recordCheckIn],
  );

  const handleCheckInSkip = useCallback(
    (checkIn: CheckIn) => recordCheckIn(checkIn),
    [recordCheckIn],
  );

  const scrollToCheckIn = useCallback(() => {
    checkInRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Resolve effective status: overlay persisted statuses onto generated actions
  const resolveActions = (actions: Action[]) =>
    actions.map((action) => ({
      ...action,
      status: state.actionStatuses[action.id] ?? action.status,
    }));

  const immediateResolved = resolveActions(actionPlan.immediate);
  const stabilizationResolved = resolveActions(actionPlan.stabilization);
  const compoundingResolved = resolveActions(actionPlan.compounding);

  const totalActions =
    actionPlan.immediate.length +
    actionPlan.stabilization.length +
    actionPlan.compounding.length;

  return (
    <div>
      <h2 className="text-2xl font-bold text-fortress-navy mb-2">
        Financial Readiness Dashboard
      </h2>
      <p className="text-gray-600 mb-6">
        Your personalized risk score based on current financial data.
      </p>

      {/* Check-in banner (when due) */}
      {checkInDue && pendingCheckIn && (
        <CheckInBanner onScrollToCheckIn={scrollToCheckIn} />
      )}

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
      {totalActions > 0 && (
        <section className="mt-8">
          <h3 className="text-lg font-semibold text-fortress-navy mb-4">
            Action Plan
          </h3>

          {immediateResolved.length > 0 && (
            <ActionTier
              title="This Week"
              subtitle="Quick wins to improve your financial readiness in the next 7 days."
              actions={immediateResolved}
              onStatusChange={handleStatusChange}
            />
          )}

          {stabilizationResolved.length > 0 && (
            <ActionTier
              title="Next 30 Days"
              subtitle="Medium-effort steps to stabilize your financial position."
              actions={stabilizationResolved}
              onStatusChange={handleStatusChange}
            />
          )}

          {compoundingResolved.length > 0 && (
            <ActionTier
              title="90-Day Goals"
              subtitle="Longer-term actions for lasting financial improvement."
              actions={compoundingResolved}
              onStatusChange={handleStatusChange}
            />
          )}

          <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-xs text-gray-500 leading-relaxed">
              {ACTION_PLAN_DISCLAIMER}
            </p>
          </div>
        </section>
      )}

      {/* Check-In Section */}
      <section className="mt-8 space-y-4" ref={checkInRef}>
        {/* Active check-in card (when pending) */}
        {pendingCheckIn && questions.length > 0 && (
          <CheckInCard
            checkIn={pendingCheckIn}
            questions={questions}
            onComplete={handleCheckInComplete}
            onSkip={handleCheckInSkip}
          />
        )}

        {/* Trajectory progress (always shown when trajectories exist) */}
        {trajectories.length > 0 && (
          <TrajectoryCard trajectories={trajectories} />
        )}

        {/* Check-in history */}
        <CheckInHistory checkIns={state.checkIns} />
      </section>

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
