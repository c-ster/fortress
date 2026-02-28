/**
 * Chart axes: X-axis (years), Y-axis (value), and horizontal gridlines.
 *
 * Uses D3 axis generators imperatively via useRef + useEffect.
 * This is the one place D3 touches the DOM directly.
 */

import { useRef, useEffect } from 'react';
import { select, axisBottom, axisLeft } from 'd3';
import type { ScaleLinear } from 'd3';
import type { ChartMetric, ChartDimensions } from './chart-types';
import { generateYearTicks, formatDollarCompact } from './chart-scales';

interface ChartAxesProps {
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
  dimensions: ChartDimensions;
  metric: ChartMetric;
}

function formatYTick(value: number, metric: ChartMetric): string {
  if (metric === 'emergencyFundMonths') {
    return `${value.toFixed(0)} mo`;
  }
  return formatDollarCompact(value);
}

export function ChartAxes({ xScale, yScale, dimensions, metric }: ChartAxesProps) {
  const xAxisRef = useRef<SVGGElement>(null);
  const yAxisRef = useRef<SVGGElement>(null);

  // Render X-axis
  useEffect(() => {
    if (!xAxisRef.current) return;
    const [, maxMonth] = xScale.domain();
    const ticks = generateYearTicks(maxMonth);
    const axis = axisBottom(xScale)
      .tickValues(ticks)
      .tickFormat((d) => `Yr ${Math.round(Number(d) / 12)}`)
      .tickSizeOuter(0);
    select(xAxisRef.current)
      .call(axis)
      .selectAll('text')
      .attr('class', 'text-xs fill-gray-500');
  }, [xScale]);

  // Render Y-axis
  useEffect(() => {
    if (!yAxisRef.current) return;
    const axis = axisLeft(yScale)
      .ticks(6)
      .tickFormat((d) => formatYTick(Number(d), metric))
      .tickSizeOuter(0);
    select(yAxisRef.current)
      .call(axis)
      .selectAll('text')
      .attr('class', 'text-xs fill-gray-500');
  }, [yScale, metric]);

  // Gridline tick values
  const gridTicks = yScale.ticks(6);

  return (
    <g className="chart-axes">
      {/* Horizontal gridlines */}
      <g className="gridlines">
        {gridTicks.map((tick) => (
          <line
            key={tick}
            x1={0}
            x2={dimensions.innerWidth}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="#94a3b8"
            strokeOpacity={0.15}
          />
        ))}
      </g>

      {/* X-axis */}
      <g
        ref={xAxisRef}
        transform={`translate(0,${dimensions.innerHeight})`}
      />

      {/* Y-axis */}
      <g ref={yAxisRef} />
    </g>
  );
}
