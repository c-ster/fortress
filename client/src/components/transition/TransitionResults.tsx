/**
 * Transition results display.
 * Shows income comparison, retirement pay, benefits transition,
 * TSP summary, emergency fund adequacy, and recommendation.
 */

import type { TransitionPlan } from '@fortress/types';

interface TransitionResultsProps {
  plan: TransitionPlan;
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

export function TransitionResults({ plan }: TransitionResultsProps) {
  const { incomeComparison: inc, retirementPay: ret, benefits, tspSummary, emergencyFundAdequacy: emg } = plan;
  const deltaColor = inc.monthlyDelta >= 0 ? 'text-fortress-green' : 'text-fortress-red';
  const deltaSign = inc.monthlyDelta >= 0 ? '+' : '';

  return (
    <div className="space-y-4">
      {/* Income Comparison */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-4 uppercase tracking-wider">
          Income Comparison
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-400">Current Military Net</p>
            <p className="text-lg font-bold text-fortress-slate tabular-nums">
              {fmt(inc.currentMilitaryNet)}/mo
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Post-Service Total</p>
            <p className="text-lg font-bold text-fortress-slate tabular-nums">
              {fmt(inc.totalPostServiceIncome)}/mo
            </p>
          </div>
        </div>

        <div className={`text-center p-3 rounded-md ${inc.monthlyDelta >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className={`text-xl font-bold tabular-nums ${deltaColor}`}>
            {deltaSign}{fmt(inc.monthlyDelta)}/mo
          </p>
        </div>

        <div className="mt-4 space-y-1.5">
          <Row label="Civilian Income (after tax)" value={`${fmt(inc.projectedCivilianNet)}/mo`} />
          {ret.eligible && <Row label="Retirement Pay" value={`${fmt(inc.retirementIncome)}/mo`} />}
          {inc.vaDisabilityIncome > 0 && (
            <Row label="VA Disability (tax-free)" value={`${fmt(inc.vaDisabilityIncome)}/mo`} />
          )}
        </div>
      </div>

      {/* Retirement Pay */}
      {ret.eligible && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wider">
            Retirement Pay
          </h3>
          <div className="space-y-1.5">
            <Row label="System" value={ret.system === 'brs' ? 'BRS' : 'Legacy (High-3)'} />
            <Row label="High-3 Base Pay" value={fmt(ret.highThreeBase)} />
            <Row label="Multiplier" value={`${(ret.multiplier * 100).toFixed(1)}% per year`} />
            <Row label="Monthly Retirement Pay" value={fmt(ret.monthlyRetirementPay)} bold />
            <Row label="Annual Retirement Pay" value={fmt(ret.annualRetirementPay)} />
          </div>
          {ret.brsLumpSum > 0 && (
            <div className="mt-3 p-3 rounded-md bg-fortress-navy/5 border border-fortress-navy/10">
              <p className="text-sm font-medium text-fortress-navy">BRS Lump Sum Option</p>
              <div className="mt-1 space-y-1">
                <Row label="Lump Sum Payment" value={fmt(ret.brsLumpSum)} bold />
                <Row label="Reduced Monthly Pay" value={`${fmt(ret.reducedMonthlyIfLumpSum)}/mo`} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Benefits Transition */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wider">
          Benefits Transition
        </h3>
        <div className="space-y-1.5">
          <Row label="Current TRICARE Cost" value={`${fmt(benefits.tricareCost)}/mo`} />
          <Row label="Civilian Health Insurance" value={`${fmt(benefits.civilianHealthCost)}/mo`} />
          <Row
            label="Healthcare Cost Change"
            value={`+${fmt(benefits.healthCostDelta)}/mo`}
          />
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <Row label="Current SGLI Coverage" value={fmt(benefits.sgliCoverage)} />
          <Row label="Est. VGLI Premium" value={`${fmt(benefits.vgliEstimatedCost)}/mo`} />
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${benefits.giEligible ? 'text-fortress-green' : 'text-gray-400'}`}>
              {benefits.giEligible ? '✓' : '✗'}
            </span>
            <span className="text-sm text-fortress-slate">
              Post-9/11 GI Bill {benefits.giEligible ? 'Eligible' : 'Not Eligible'}
            </span>
          </div>
        </div>
      </div>

      {/* TSP Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wider">
          TSP Strategy
        </h3>
        <Row label="Current TSP Balance" value={fmt(tspSummary.balance)} bold />
        <div className="mt-2">
          <p className="text-sm font-medium text-fortress-slate">{tspSummary.action}</p>
          <p className="text-xs text-gray-500 mt-1">{tspSummary.taxImplication}</p>
        </div>
      </div>

      {/* Emergency Fund Adequacy */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wider">
          Transition Emergency Fund
        </h3>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Coverage</span>
          <span className="font-medium text-fortress-slate tabular-nums">
            {emg.months.toFixed(1)} months of {fmt(Math.round(emg.recommended / 6))}/mo
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
            Gap: {fmt(emg.gap)} needed to reach 6-month buffer ({fmt(emg.recommended)})
          </p>
        ) : (
          <p className="text-xs text-fortress-green mt-1">
            Emergency fund meets recommended 6-month transition buffer
          </p>
        )}
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
