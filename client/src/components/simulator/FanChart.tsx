/**
 * Percentile fan chart: shaded bands (p10–p90, p25–p75) + median line (p50).
 *
 * Uses D3 area/line generators for path strings; React renders the SVG.
 */

import { useMemo } from 'react';
import { area, line, curveMonotoneX } from 'd3';
import type { ScaleLinear } from 'd3';
import type { SimulationResult } from '@fortress/types';
import type { ChartMetric, MetricConfig } from './chart-types';

interface FanChartProps {
  projections: SimulationResult['projections'];
  metric: ChartMetric;
  metricConfig: MetricConfig;
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
}

type Projection = SimulationResult['projections'][number];

export function FanChart({
  projections,
  metric,
  metricConfig,
  xScale,
  yScale,
}: FanChartProps) {
  // Generate SVG path strings via D3 generators
  const { outerBand, innerBand, medianLine } = useMemo(() => {
    const x = (d: Projection) => xScale(d.month);

    // Outer band: p10–p90
    const outerArea = area<Projection>()
      .x(x)
      .y0((d) => yScale(d[metric].p10))
      .y1((d) => yScale(d[metric].p90))
      .curve(curveMonotoneX);

    // Inner band: p25–p75
    const innerArea = area<Projection>()
      .x(x)
      .y0((d) => yScale(d[metric].p25))
      .y1((d) => yScale(d[metric].p75))
      .curve(curveMonotoneX);

    // Median line: p50
    const median = line<Projection>()
      .x(x)
      .y((d) => yScale(d[metric].p50))
      .curve(curveMonotoneX);

    return {
      outerBand: outerArea(projections) ?? '',
      innerBand: innerArea(projections) ?? '',
      medianLine: median(projections) ?? '',
    };
  }, [projections, metric, xScale, yScale]);

  const { color } = metricConfig;

  return (
    <g className="fan-chart">
      {/* Outer band: p10–p90 */}
      <path
        d={outerBand}
        fill={color}
        opacity={0.08}
        stroke="none"
      />
      {/* Inner band: p25–p75 */}
      <path
        d={innerBand}
        fill={color}
        opacity={0.18}
        stroke="none"
      />
      {/* Median line: p50 */}
      <path
        d={medianLine}
        fill="none"
        stroke={color}
        strokeWidth={2}
        opacity={0.9}
      />
    </g>
  );
}
