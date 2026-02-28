/**
 * Milestone markers: vertical dashed lines at milestone months with hover tooltips.
 */

import { useState } from 'react';
import type { ScaleLinear } from 'd3';
import type { MilestoneEstimate } from '@fortress/types';
import type { ChartDimensions } from './chart-types';

interface MilestoneMarkersProps {
  milestones: Record<string, MilestoneEstimate | null>;
  xScale: ScaleLinear<number, number>;
  dimensions: ChartDimensions;
}

interface MilestoneDisplayConfig {
  label: string;
  color: string;
}

const MILESTONE_CONFIG: Record<string, MilestoneDisplayConfig> = {
  debt_free: { label: 'Debt Free', color: '#22c55e' },
  emergency_fund_3mo: { label: '3-Mo EF', color: '#3b82f6' },
  emergency_fund_6mo: { label: '6-Mo EF', color: '#1e3a5f' },
  net_worth_100k: { label: '$100K NW', color: '#eab308' },
  net_worth_500k: { label: '$500K NW', color: '#f97316' },
};

function formatMilestoneMonth(month: number): string {
  const years = Math.floor(month / 12);
  const months = month % 12;
  return years > 0
    ? `Year ${years}${months > 0 ? `, Month ${months}` : ''}`
    : `Month ${month}`;
}

export function MilestoneMarkers({ milestones, xScale, dimensions }: MilestoneMarkersProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [, maxMonth] = xScale.domain();

  const entries = Object.entries(milestones)
    .filter(
      (entry): entry is [string, MilestoneEstimate] =>
        entry[1] !== null && entry[1].medianMonth <= maxMonth,
    )
    .map(([key, milestone]) => ({
      key,
      milestone,
      config: MILESTONE_CONFIG[key] ?? { label: key, color: '#94a3b8' },
      x: xScale(milestone.medianMonth),
    }));

  if (entries.length === 0) return null;

  return (
    <g className="milestone-markers">
      {entries.map(({ key, milestone, config, x }) => (
        <g
          key={key}
          onMouseEnter={() => setHoveredKey(key)}
          onMouseLeave={() => setHoveredKey(null)}
          style={{ cursor: 'pointer' }}
        >
          {/* Vertical dashed line */}
          <line
            x1={x}
            x2={x}
            y1={0}
            y2={dimensions.innerHeight}
            stroke={config.color}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            opacity={0.6}
          />
          {/* Label at top */}
          <text
            x={x}
            y={-6}
            textAnchor="middle"
            fill={config.color}
            fontSize={10}
            fontWeight={600}
          >
            {config.label}
          </text>

          {/* Hover tooltip */}
          {hoveredKey === key && (
            <foreignObject
              x={Math.min(x - 80, dimensions.innerWidth - 170)}
              y={20}
              width={170}
              height={80}
            >
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-2 text-xs">
                <p className="font-semibold" style={{ color: config.color }}>
                  {config.label}
                </p>
                <p className="text-gray-600">
                  {formatMilestoneMonth(milestone.medianMonth)}
                </p>
                <p className="text-gray-400">
                  Range: {formatMilestoneMonth(milestone.rangeMonths[0])} –{' '}
                  {formatMilestoneMonth(milestone.rangeMonths[1])}
                </p>
                {milestone.achievedInAllRuns && (
                  <p className="text-fortress-green font-medium mt-0.5">
                    Achieved in all runs
                  </p>
                )}
              </div>
            </foreignObject>
          )}
        </g>
      ))}
    </g>
  );
}
