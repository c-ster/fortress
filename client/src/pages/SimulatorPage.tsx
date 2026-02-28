/**
 * Financial Path Simulator page.
 *
 * Two-column layout: scenario controls (left) + fan chart (right).
 * Wires useSimulator hook to ScenarioControls, SimulatorChart, and ComparisonSummary.
 */

import { Link } from 'react-router-dom';
import { useFinancialStore } from '../stores/financial-state';
import { useSimulator } from '../hooks/useSimulator';
import { SimulatorChart } from '../components/simulator';
import { ScenarioControls } from '../components/simulator/ScenarioControls';
import { ComparisonSummary } from '../components/simulator/ComparisonSummary';

export function SimulatorPage() {
  const financialState = useFinancialStore((s) => s.state);
  const {
    scenario,
    result,
    comparison,
    isRunning,
    progress,
    baselineScenario,
    updateScenario,
    previewScenario,
    setBaseline,
    clearBaseline,
  } = useSimulator();

  const hasData = financialState.meta.completeness > 0.2;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-fortress-navy">Financial Projections</h2>
        <p className="text-gray-500 mt-1">
          Explore how different financial decisions affect your 40-year trajectory.
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
              Complete your financial intake for more accurate projections.
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
        {/* Controls */}
        <div className="lg:col-span-1">
          <ScenarioControls
            scenario={scenario}
            onUpdate={updateScenario}
            onPreview={previewScenario}
            isRunning={isRunning}
            basePay={financialState.income.basePay}
          />

          {/* Comparison toggle */}
          <div className="mt-4">
            {baselineScenario ? (
              <button
                onClick={clearBaseline}
                className="w-full px-4 py-2 text-sm font-medium rounded-md
                  border border-fortress-red text-fortress-red hover:bg-red-50
                  transition-colors"
              >
                Exit Comparison Mode
              </button>
            ) : (
              <button
                onClick={setBaseline}
                disabled={!result}
                className="w-full px-4 py-2 text-sm font-medium rounded-md
                  bg-fortress-navy text-white hover:bg-fortress-navy/90
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Compare Scenarios
              </button>
            )}
            {baselineScenario && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Baseline locked. Adjust controls to see the difference.
              </p>
            )}
          </div>
        </div>

        {/* Chart + results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Chart with loading overlay */}
          <div className="relative">
            {result && <SimulatorChart result={result} />}

            {!result && !isRunning && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-16
                text-center text-gray-400">
                <p className="text-lg">No projection data yet</p>
                <p className="text-sm mt-1">Adjust scenario controls to generate projections</p>
              </div>
            )}

            {isRunning && (
              <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center
                justify-center z-10">
                <div className="text-center">
                  <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-fortress-navy rounded-full transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Running simulation... {progress}%
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Milestone summary */}
          {result && (
            <MilestoneSummary milestones={result.milestones} />
          )}

          {/* Comparison results */}
          {comparison && <ComparisonSummary comparison={comparison} />}
        </div>
      </div>
    </div>
  );
}

// --- Milestone Summary ---

function MilestoneSummary({
  milestones,
}: {
  milestones: Record<string, { medianMonth: number; rangeMonths: [number, number]; achievedInAllRuns: boolean } | null>;
}) {
  const items = Object.entries(milestones).filter(
    (e): e is [string, NonNullable<typeof e[1]>] => e[1] !== null,
  );

  if (items.length === 0) return null;

  const labels: Record<string, string> = {
    debt_free: 'Debt Free',
    emergency_fund_3mo: '3-Month Emergency Fund',
    emergency_fund_6mo: '6-Month Emergency Fund',
    net_worth_100k: '$100K Net Worth',
    net_worth_500k: '$500K Net Worth',
  };

  const formatMonth = (m: number) => {
    const yr = Math.floor(m / 12);
    const mo = m % 12;
    return yr > 0 ? `${yr}y ${mo}m` : `${mo}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-fortress-navy mb-3">Milestones (Median)</h3>
      <div className="flex flex-wrap gap-3">
        {items.map(([key, ms]) => (
          <div
            key={key}
            className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-1.5 text-xs"
          >
            <span className="text-fortress-green font-bold">{formatMonth(ms.medianMonth)}</span>
            <span className="text-gray-600">{labels[key] ?? key}</span>
            {ms.achievedInAllRuns && (
              <span className="text-fortress-green" title="Achieved in all simulation runs">
                &#10003;
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
