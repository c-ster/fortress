import { useMemo, useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinancialStore } from '../stores/financial-state';
import { calculateRiskScore } from '../engine/risk-engine';
import { generateActionPlan, ACTION_PLAN_DISCLAIMER } from '../engine/action-generator';
import { buildPdfContent } from '../engine/pdf-generator';
import { downloadSummaryPdf } from '../services/pdf-renderer';
import {
  isCheckInDue,
  getPendingCheckIn,
  selectQuestions,
  calculateTrajectory,
} from '../engine/check-in-scheduler';
import { RiskScore } from '../components/dashboard/RiskScore';
import { QuickStats } from '../components/dashboard/QuickStats';
import { FindingCard } from '../components/dashboard/FindingCard';
import { ActionTier } from '../components/dashboard/ActionTier';
import { DataQualityBanner } from '../components/dashboard/DataQualityBanner';
import { CheckInBanner } from '../components/dashboard/CheckInBanner';
import { CheckInCard } from '../components/dashboard/CheckInCard';
import { TrajectoryCard } from '../components/dashboard/TrajectoryCard';
import { CheckInHistory } from '../components/dashboard/CheckInHistory';
import { SimulatorCta } from '../components/dashboard/SimulatorCta';
import { ReferralModal } from '../components/dashboard/ReferralModal';
import type { Action, ActionPlan, CheckIn, FinancialState, RiskAssessment } from '@fortress/types';

export function Dashboard() {
  const { state, setActionStatus, recordCheckIn } = useFinancialStore();
  const checkInRef = useRef<HTMLDivElement>(null);
  const [showReferral, setShowReferral] = useState(false);

  // --- Derived data ---
  const assessment = useMemo(() => calculateRiskScore(state), [state]);
  const actionPlan = useMemo(
    () => generateActionPlan(state, assessment),
    [state, assessment],
  );

  const checkInDue = useMemo(() => isCheckInDue(state.checkIns), [state.checkIns]);
  const pendingCheckIn = useMemo(() => getPendingCheckIn(state.checkIns), [state.checkIns]);
  const questions = useMemo(() => selectQuestions(state), [state]);
  const trajectories = useMemo(
    () => calculateTrajectory(state, state.checkIns),
    [state],
  );

  // --- Handlers ---
  const handleStatusChange = useCallback(
    (actionId: string, status: Action['status']) => setActionStatus(actionId, status),
    [setActionStatus],
  );

  const handleCheckIn = useCallback(
    (ci: CheckIn) => recordCheckIn(ci),
    [recordCheckIn],
  );

  const scrollToCheckIn = useCallback(() => {
    checkInRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // --- Resolved actions ---
  const resolveActions = (actions: Action[]) =>
    actions.map((a) => ({ ...a, status: state.actionStatuses[a.id] ?? a.status }));

  const immediateResolved = resolveActions(actionPlan.immediate);
  const stabilizationResolved = resolveActions(actionPlan.stabilization);
  const compoundingResolved = resolveActions(actionPlan.compounding);
  const allResolved = [...immediateResolved, ...stabilizationResolved, ...compoundingResolved];

  const totalActions = allResolved.length;
  const actionsRemaining = allResolved.filter(
    (a) => a.status === 'pending' || a.status === 'deferred',
  ).length;

  return (
    <div>
      <h2 className="text-2xl font-bold text-fortress-navy mb-2">
        Financial Readiness Dashboard
      </h2>
      <p className="text-gray-600 mb-6">
        Your personalized financial readiness overview.
      </p>

      {/* Banners */}
      {checkInDue && pendingCheckIn && (
        <CheckInBanner onScrollToCheckIn={scrollToCheckIn} />
      )}
      {assessment.dataQuality < 0.5 && (
        <DataQualityBanner completeness={assessment.dataQuality} />
      )}

      {/* Risk Score + Quick Stats grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <RiskScore score={assessment.overallScore} tier={assessment.tier} />
        <div className="lg:col-span-2 flex flex-col justify-center">
          <QuickStats
            emergencyFundMonths={state.risk.emergencyFundMonths}
            debtToIncomeRatio={state.risk.debtToIncomeRatio}
            actionsRemaining={actionsRemaining}
            tspMatchCaptured={state.risk.tspMatchCaptured}
          />
        </div>
      </div>

      {/* Findings */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-fortress-navy mb-4">
          Findings{' '}
          <span className="text-sm font-normal text-gray-400">
            ({assessment.findings.length})
          </span>
        </h3>
        {assessment.findings.length === 0 ? (
          <div className="bg-green-50 border border-fortress-green/30 rounded-lg p-6 text-center">
            <span className="text-fortress-green text-2xl font-bold">&#10003;</span>
            <p className="text-sm text-green-800 mt-2">
              No risk findings — great financial readiness posture!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assessment.findings.map((f) => <FindingCard key={f.id} finding={f} />)}
          </div>
        )}
      </section>

      {/* Action Plan */}
      {totalActions > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-fortress-navy mb-4">Action Plan</h3>
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
            <p className="text-xs text-gray-500 leading-relaxed">{ACTION_PLAN_DISCLAIMER}</p>
          </div>
        </section>
      )}

      {/* Check-In & Progress */}
      <section className="mb-8 space-y-4" ref={checkInRef}>
        {pendingCheckIn && questions.length > 0 && (
          <CheckInCard
            checkIn={pendingCheckIn}
            questions={questions}
            onComplete={handleCheckIn}
            onSkip={handleCheckIn}
          />
        )}
        {trajectories.length > 0 && <TrajectoryCard trajectories={trajectories} />}
        <CheckInHistory checkIns={state.checkIns} />
      </section>

      {/* Simulator CTA */}
      <div className="mb-8">
        <SimulatorCta />
      </div>

      {/* Footer links */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/intake"
          className="border border-fortress-navy text-fortress-navy px-6 py-2.5
            rounded-md text-sm font-medium hover:bg-fortress-navy/10 transition-colors"
        >
          Update Financial Data
        </Link>
        <DownloadPdfButton state={state} assessment={assessment} actionPlan={actionPlan} />
        <button
          onClick={() => setShowReferral(true)}
          className="border border-fortress-navy text-fortress-navy px-6 py-2.5
            rounded-md text-sm font-medium hover:bg-fortress-navy/10 transition-colors"
        >
          Email to Counselor
        </button>
      </div>

      {showReferral && (
        <ReferralModal
          state={state}
          assessment={assessment}
          actionPlan={actionPlan}
          onClose={() => setShowReferral(false)}
        />
      )}
    </div>
  );
}

// --- PDF download button ---

function DownloadPdfButton({
  state,
  assessment,
  actionPlan,
}: {
  state: FinancialState;
  assessment: RiskAssessment;
  actionPlan: ActionPlan;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const content = buildPdfContent(state, assessment, actionPlan);
      await downloadSummaryPdf(content);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="border border-fortress-navy text-fortress-navy px-6 py-2.5
        rounded-md text-sm font-medium hover:bg-fortress-navy/10
        disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {downloading ? 'Generating...' : 'Download Summary PDF'}
    </button>
  );
}
