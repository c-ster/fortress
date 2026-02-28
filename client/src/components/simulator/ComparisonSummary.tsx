/**
 * Comparison summary cards showing delta metrics between baseline and
 * alternative scenarios.
 */

import type { ComparisonDelta, PercentileBand } from '@fortress/types';
import { formatDollarCompact } from './chart-scales';

interface ComparisonSummaryProps {
  comparison: ComparisonDelta;
}

interface MetricCardProps {
  label: string;
  band: PercentileBand;
  format: (v: number) => string;
  positiveIsGood?: boolean;
}

function MetricCard({ label, band, format, positiveIsGood = true }: MetricCardProps) {
  const isPositive = band.p50 > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  const colorClass = band.p50 === 0
    ? 'text-gray-500'
    : isGood
      ? 'text-fortress-green'
      : 'text-fortress-red';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClass}`}>
        {band.p50 > 0 && '+'}
        {format(band.p50)}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Range: {format(band.p10)} to {format(band.p90)}
      </p>
    </div>
  );
}

export function ComparisonSummary({ comparison }: ComparisonSummaryProps) {
  const formatMonths = (v: number): string => {
    const abs = Math.abs(v);
    if (abs < 1) return '0 months';
    const years = Math.floor(abs / 12);
    const months = Math.round(abs % 12);
    const sign = v < 0 ? '-' : '';
    if (years === 0) return `${sign}${months} mo`;
    if (months === 0) return `${sign}${years} yr`;
    return `${sign}${years} yr ${months} mo`;
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-fortress-navy mb-3 uppercase tracking-wide">
        Scenario Comparison
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Interest Saved"
          band={comparison.totalInterestSaved}
          format={formatDollarCompact}
        />
        <MetricCard
          label="Debt-Free Earlier"
          band={comparison.debtFreeMonthsEarlier}
          format={formatMonths}
        />
        <MetricCard
          label="Extra TSP at Retirement"
          band={comparison.additionalTSPAtRetirement}
          format={formatDollarCompact}
        />
      </div>
    </div>
  );
}
