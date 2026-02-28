/**
 * Main simulator chart component.
 *
 * Orchestrates the metric selector, responsive sizing, D3 scales,
 * and renders the SVG containing FanChart, ChartAxes, and MilestoneMarkers.
 *
 * Public API consumed by the Simulator page (task 1.4.6):
 *   <SimulatorChart result={simulationResult} />
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import type { SimulatorChartProps, ChartMetric } from './chart-types';
import {
  METRICS,
  getMetricConfig,
  createXScale,
  createYScale,
  getDimensions,
} from './chart-scales';
import { ChartAxes } from './ChartAxes';
import { FanChart } from './FanChart';
import { MilestoneMarkers } from './MilestoneMarkers';

export function SimulatorChart({ result, className = '' }: SimulatorChartProps) {
  const [metric, setMetric] = useState<ChartMetric>('netWorth');
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Responsive width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const metricConfig = getMetricConfig(metric);
  const dimensions = useMemo(() => getDimensions(containerWidth), [containerWidth]);

  const xScale = useMemo(
    () => createXScale(result.projections, dimensions.innerWidth),
    [result.projections, dimensions.innerWidth],
  );

  const yScale = useMemo(
    () => createYScale(result.projections, metric, dimensions.innerHeight),
    [result.projections, metric, dimensions.innerHeight],
  );

  return (
    <div
      ref={containerRef}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}
    >
      {/* Metric selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              metric === m.key
                ? 'bg-fortress-navy text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <svg
        width={dimensions.width}
        height={dimensions.height}
        role="img"
        aria-label={`Financial projection chart showing ${metricConfig.label}`}
      >
        <g transform={`translate(${dimensions.margin.left},${dimensions.margin.top})`}>
          <ChartAxes
            xScale={xScale}
            yScale={yScale}
            dimensions={dimensions}
            metric={metric}
          />
          <FanChart
            projections={result.projections}
            metric={metric}
            metricConfig={metricConfig}
            xScale={xScale}
            yScale={yScale}
          />
          <MilestoneMarkers
            milestones={result.milestones}
            xScale={xScale}
            dimensions={dimensions}
          />
        </g>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-8 h-0.5 rounded"
            style={{ backgroundColor: metricConfig.color }}
          />
          Median (p50)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 h-3 rounded-sm"
            style={{ backgroundColor: metricConfig.color, opacity: 0.18 }}
          />
          25th–75th pctl
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 h-3 rounded-sm"
            style={{ backgroundColor: metricConfig.color, opacity: 0.08 }}
          />
          10th–90th pctl
        </span>
      </div>
    </div>
  );
}
