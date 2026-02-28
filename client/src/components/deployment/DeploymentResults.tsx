/**
 * Deployment results display.
 * Shows budget impact, bill audit table, spousal summary, and recommendation.
 */

import type { DeploymentPlan } from '@fortress/types';

interface DeploymentResultsProps {
  plan: DeploymentPlan;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const PRIORITY_STYLES = {
  critical: { bg: 'bg-red-50', text: 'text-fortress-red', label: 'Critical' },
  important: { bg: 'bg-yellow-50', text: 'text-fortress-yellow', label: 'Important' },
  optional: { bg: 'bg-gray-50', text: 'text-gray-400', label: 'Optional' },
};

export function DeploymentResults({ plan }: DeploymentResultsProps) {
  const { budgetImpact, billAudit, spousalSummary, recommendation } = plan;
  const deltaColor = budgetImpact.monthlyDelta >= 0 ? 'text-fortress-green' : 'text-fortress-red';
  const deltaSign = budgetImpact.monthlyDelta >= 0 ? '+' : '';

  return (
    <div className="space-y-4">
      {/* Budget Impact */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-4 uppercase tracking-wider">
          Budget Impact
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-400">Current Monthly Net</p>
            <p className="text-lg font-bold text-fortress-slate tabular-nums">
              {fmt(budgetImpact.currentMonthlyNet)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">During Deployment</p>
            <p className="text-lg font-bold text-fortress-slate tabular-nums">
              {fmt(budgetImpact.deploymentMonthlyNet)}
            </p>
          </div>
        </div>

        <div className={`text-center p-3 rounded-md ${
          budgetImpact.monthlyDelta >= 0 ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <p className={`text-xl font-bold tabular-nums ${deltaColor}`}>
            {deltaSign}{fmt(budgetImpact.monthlyDelta)}/mo
          </p>
          <p className={`text-xs ${deltaColor}`}>
            {deltaSign}{fmt(budgetImpact.totalImpact)} over {budgetImpact.deploymentMonths} months
          </p>
        </div>

        {/* Buffer Status */}
        <div className="mt-4 p-3 rounded-md bg-gray-50">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Emergency Buffer</span>
            <span className="font-medium text-fortress-slate tabular-nums">
              {fmt(budgetImpact.currentBuffer)} / {fmt(budgetImpact.recommendedBuffer)}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                budgetImpact.bufferGap === 0 ? 'bg-fortress-green' : 'bg-fortress-yellow'
              }`}
              style={{
                width: `${Math.min(100, budgetImpact.recommendedBuffer > 0
                  ? (budgetImpact.currentBuffer / budgetImpact.recommendedBuffer) * 100
                  : 100)}%`,
              }}
            />
          </div>
          {budgetImpact.bufferGap > 0 && (
            <p className="text-xs text-fortress-red mt-1">
              Gap: {fmt(budgetImpact.bufferGap)} needed to reach recommended buffer
            </p>
          )}
          {budgetImpact.bufferGap === 0 && (
            <p className="text-xs text-fortress-green mt-1">
              Emergency buffer meets recommended level
            </p>
          )}
        </div>
      </div>

      {/* Bill Audit */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wider">
          Auto-Pay Audit
        </h3>
        {billAudit.length === 0 ? (
          <p className="text-sm text-gray-400">No recurring bills detected.</p>
        ) : (
          <div className="space-y-2">
            {billAudit.map((bill) => {
              const style = PRIORITY_STYLES[bill.priority];
              return (
                <div
                  key={`${bill.category}-${bill.label}`}
                  className={`flex items-start gap-3 p-3 rounded-md ${style.bg}`}
                >
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${style.text} bg-white`}>
                    {style.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium text-fortress-slate">{bill.label}</p>
                      <p className="text-sm font-medium text-fortress-slate tabular-nums">
                        {fmt(bill.monthlyAmount)}/mo
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{bill.recommendation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Spousal Summary */}
      {spousalSummary && (
        <div className="bg-fortress-navy/5 border border-fortress-navy/15 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-fortress-navy mb-2">
            Spousal Financial Handover
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">{spousalSummary}</p>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-2">
          Recommendation
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed">{recommendation}</p>
      </div>
    </div>
  );
}
