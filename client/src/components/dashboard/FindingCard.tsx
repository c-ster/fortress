import type { RiskFinding } from '@fortress/types';

interface FindingCardProps {
  finding: RiskFinding;
}

const severityConfig = {
  critical: {
    border: 'border-l-fortress-red',
    badge: 'bg-fortress-red',
    label: 'Critical',
  },
  warning: {
    border: 'border-l-fortress-yellow',
    badge: 'bg-fortress-yellow',
    label: 'Warning',
  },
  info: {
    border: 'border-l-blue-400',
    badge: 'bg-blue-400',
    label: 'Info',
  },
} as const;

export function FindingCard({ finding }: FindingCardProps) {
  const config = severityConfig[finding.severity];

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 ${config.border}
        border-l-4 p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-fortress-navy">{finding.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{finding.description}</p>
          <p className="text-sm text-fortress-slate mt-2 font-medium">{finding.impact}</p>
        </div>
        <span
          className={`${config.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full
            whitespace-nowrap shrink-0`}
        >
          {config.label}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-2">-{finding.pointsDeducted} points</p>
    </div>
  );
}
