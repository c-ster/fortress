/**
 * PCS cost breakdown display.
 * Shows allowances table, BAH delta, out-of-pocket estimates,
 * net cost summary, and engine-generated recommendation.
 */

import type { PcsCostBreakdown as CostBreakdown } from '@fortress/types';

interface PcsCostBreakdownProps {
  result: CostBreakdown;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function Row({ label, amount, muted }: { label: string; amount: number; muted?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${muted ? 'text-gray-400' : 'text-fortress-slate'}`}>
      <span className="text-sm">{label}</span>
      <span className="text-sm font-medium tabular-nums">{fmt(amount)}</span>
    </div>
  );
}

function TotalRow({ label, amount, color }: { label: string; amount: number; color?: string }) {
  const textColor = color ?? 'text-fortress-navy';
  return (
    <div className={`flex justify-between py-2 border-t border-gray-200 ${textColor}`}>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm font-bold tabular-nums">{fmt(amount)}</span>
    </div>
  );
}

export function PcsCostBreakdown({ result }: PcsCostBreakdownProps) {
  const { allowances, bahDelta, oopEstimate, netCost, totalAllowances, recommendation } = result;

  const deltaColor = bahDelta.monthlyDelta >= 0 ? 'text-fortress-green' : 'text-fortress-red';
  const deltaSign = bahDelta.monthlyDelta >= 0 ? '+' : '';

  return (
    <div className="space-y-4">
      {/* Allowances */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wider">
          Allowances
        </h3>
        <div className="divide-y divide-gray-100">
          <Row label="Dislocation Allowance (DLA)" amount={allowances.dla} />
          <Row label="POV Mileage" amount={allowances.mileage} />
          <Row label="Per Diem" amount={allowances.perDiem} />
          <Row label="Temporary Lodging (TLE)" amount={allowances.tle} />
          {allowances.dityIncentive > 0 && (
            <Row label="DITY/PPM Incentive" amount={allowances.dityIncentive} />
          )}
          {allowances.storageCost > 0 && (
            <Row label="Storage (SIT)" amount={allowances.storageCost} />
          )}
          <TotalRow label="Total Allowances" amount={totalAllowances} />
        </div>
      </div>

      {/* BAH Delta */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wider">
          BAH Impact
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="text-xs text-gray-400">Current BAH</p>
            <p className="text-lg font-bold text-fortress-slate tabular-nums">
              {fmt(bahDelta.currentBah)}
              <span className="text-xs font-normal text-gray-400">/mo</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">New BAH</p>
            <p className="text-lg font-bold text-fortress-slate tabular-nums">
              {fmt(bahDelta.newBah)}
              <span className="text-xs font-normal text-gray-400">/mo</span>
            </p>
          </div>
        </div>
        <div className={`text-center p-3 rounded-md ${
          bahDelta.monthlyDelta >= 0 ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <p className={`text-xl font-bold tabular-nums ${deltaColor}`}>
            {deltaSign}{fmt(bahDelta.monthlyDelta)}/mo
          </p>
          <p className={`text-xs ${deltaColor}`}>
            {deltaSign}{fmt(bahDelta.annualImpact)} annually
          </p>
        </div>
      </div>

      {/* Out-of-Pocket Estimate */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wider">
          Estimated Out-of-Pocket
        </h3>
        <div className="divide-y divide-gray-100">
          <Row label="Temporary Housing" amount={oopEstimate.temporaryHousing} />
          <Row label="Travel Meals" amount={oopEstimate.travelMeals} />
          <Row label="Security Deposits" amount={oopEstimate.securityDeposits} />
          <Row label="Utility Setup" amount={oopEstimate.utilitySetup} />
          {oopEstimate.vehicleShipping > 0 && (
            <Row label="Vehicle Shipping" amount={oopEstimate.vehicleShipping} />
          )}
          <Row label="Miscellaneous" amount={oopEstimate.miscellaneous} />
          <TotalRow label="Total Out-of-Pocket" amount={oopEstimate.total} color="text-fortress-red" />
        </div>
      </div>

      {/* Net Cost Summary */}
      <div className={`rounded-lg p-5 text-center ${
        netCost <= 0 ? 'bg-green-50 border border-fortress-green/30' : 'bg-red-50 border border-fortress-red/30'
      }`}>
        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">
          Estimated Net Cost
        </p>
        <p className={`text-3xl font-bold tabular-nums ${
          netCost <= 0 ? 'text-fortress-green' : 'text-fortress-red'
        }`}>
          {fmt(netCost)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Out-of-pocket{allowances.dityIncentive > 0 ? ' minus DITY incentive' : ''}
        </p>
      </div>

      {/* Recommendation */}
      <div className="bg-fortress-navy/5 border border-fortress-navy/15 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-fortress-navy mb-2">
          Recommendation
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed">{recommendation}</p>
      </div>
    </div>
  );
}
