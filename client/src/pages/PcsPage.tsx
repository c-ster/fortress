/**
 * PCS Cost Planner page.
 *
 * Two-column layout: input form (left) + cost breakdown & timeline (right).
 * Wires usePcs hook to PcsInputForm, PcsCostBreakdown, and PcsPhaseTimeline.
 */

import { Link } from 'react-router-dom';
import { useFinancialStore } from '../stores/financial-state';
import { usePcs } from '../hooks/usePcs';
import { PcsInputForm } from '../components/pcs/PcsInputForm';
import { PcsCostBreakdown } from '../components/pcs/PcsCostBreakdown';
import { PcsPhaseTimeline } from '../components/pcs/PcsPhaseTimeline';

export function PcsPage() {
  const financialState = useFinancialStore((s) => s.state);
  const {
    input,
    result,
    isCalculating,
    currentStation,
    newStation,
    updateInput,
  } = usePcs(financialState);

  const hasData = financialState.meta.completeness > 0.2;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-fortress-navy">PCS Cost Planner</h2>
        <p className="text-gray-500 mt-1">
          Estimate allowances, out-of-pocket costs, and BAH impact for your next move.
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
              Complete your financial intake for more accurate PCS estimates.
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
          <PcsInputForm
            input={input}
            onUpdate={updateInput}
            currentStation={currentStation}
            newStation={newStation}
            isCalculating={isCalculating}
          />
        </div>

        {/* Right: results + timeline */}
        <div className="lg:col-span-2 space-y-4">
          {result && <PcsCostBreakdown result={result} />}

          {!result && !isCalculating && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-16
              text-center text-gray-400">
              <p className="text-lg">No cost estimate yet</p>
              <p className="text-sm mt-1">
                Enter both ZIP codes and distance to calculate your PCS costs
              </p>
            </div>
          )}

          <PcsPhaseTimeline moveDate={input.moveDate} />
        </div>
      </div>
    </div>
  );
}
