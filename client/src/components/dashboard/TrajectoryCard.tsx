/**
 * Progress trajectory visualization card.
 * Shows current → target progress bars with human-readable messages.
 * No gamification: just clarity about financial trajectory.
 */

import type { TrajectoryEstimate } from '@fortress/types';

interface TrajectoryCardProps {
  trajectories: TrajectoryEstimate[];
}

const metricConfig: Record<string, { label: string; color: string }> = {
  emergencyFund: { label: 'Emergency Fund', color: 'bg-fortress-green' },
  totalDebt: { label: 'Debt Payoff', color: 'bg-fortress-red' },
  tspBalance: { label: 'TSP Growth', color: 'bg-fortress-navy' },
};

function ProgressBar({ current, target, color }: {
  current: number;
  target: number;
  color: string;
}) {
  // For debt, progress = how much is paid off (target is 0)
  const isDebt = target === 0;
  // Clamp between 0 and 100
  let pct: number;
  if (isDebt) {
    // Can't show meaningful progress bar for debt with no starting point
    pct = 0;
  } else if (target <= 0) {
    pct = 100;
  } else {
    pct = Math.min(100, Math.max(0, (current / target) * 100));
  }

  return (
    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
      <div
        className={`${color} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function TrajectoryCard({ trajectories }: TrajectoryCardProps) {
  if (trajectories.length === 0) {
    return (
      <div className="bg-green-50 border border-fortress-green/30 rounded-lg p-5 text-center">
        <span className="text-fortress-green text-2xl font-bold">&#10003;</span>
        <p className="text-sm text-green-800 mt-2">
          All key financial metrics are on track. Keep it up!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h4 className="text-base font-semibold text-fortress-navy mb-4">
        Your Progress
      </h4>

      <div className="space-y-4">
        {trajectories.map((t) => {
          const config = metricConfig[t.metric] ?? {
            label: t.metric,
            color: 'bg-gray-400',
          };
          return (
            <div key={t.metric}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-fortress-slate">
                  {config.label}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{t.message}</p>
              {t.metric !== 'totalDebt' && (
                <ProgressBar
                  current={t.currentValue}
                  target={t.targetValue}
                  color={config.color}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
