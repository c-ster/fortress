/**
 * Quick-stats summary row: 4 mini cards for at-a-glance financial metrics.
 * Shown alongside the risk score at the top of the dashboard.
 */

interface QuickStatsProps {
  emergencyFundMonths: number;
  debtToIncomeRatio: number;
  actionsRemaining: number;
  tspMatchCaptured: boolean;
}

function StatCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: 'green' | 'yellow' | 'red';
}) {
  const dotColor = {
    green: 'bg-fortress-green',
    yellow: 'bg-fortress-yellow',
    red: 'bg-fortress-red',
  }[status];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold text-fortress-navy">{value}</p>
    </div>
  );
}

export function QuickStats({
  emergencyFundMonths,
  debtToIncomeRatio,
  actionsRemaining,
  tspMatchCaptured,
}: QuickStatsProps) {
  const efStatus = emergencyFundMonths >= 3 ? 'green' : emergencyFundMonths >= 1 ? 'yellow' : 'red';
  const dtiStatus = debtToIncomeRatio <= 0.2 ? 'green' : debtToIncomeRatio <= 0.4 ? 'yellow' : 'red';
  const actionsStatus = actionsRemaining === 0 ? 'green' : actionsRemaining <= 3 ? 'yellow' : 'red';
  const tspStatus = tspMatchCaptured ? 'green' : 'red';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        label="Emergency Fund"
        value={`${emergencyFundMonths.toFixed(1)} mo`}
        status={efStatus}
      />
      <StatCard
        label="Debt-to-Income"
        value={`${(debtToIncomeRatio * 100).toFixed(0)}%`}
        status={dtiStatus}
      />
      <StatCard
        label="Actions Left"
        value={`${actionsRemaining}`}
        status={actionsStatus}
      />
      <StatCard
        label="TSP Match"
        value={tspMatchCaptured ? 'Captured' : 'Missing'}
        status={tspStatus}
      />
    </div>
  );
}
