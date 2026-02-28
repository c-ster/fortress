/**
 * D3 scale factories, metric configuration, and formatting utilities
 * for the simulator chart.
 *
 * Pure functions: no side effects, no DOM, no React.
 */

import { scaleLinear, format as d3Format } from 'd3';
import type { SimulationResult } from '@fortress/types';
import type { ChartMetric, MetricConfig, ChartDimensions } from './chart-types';

// --- Metric Configuration ---

const dollarFormat = (v: number): string => formatDollarCompact(v);
const monthsFormat = (v: number): string => `${v.toFixed(1)} mo`;

export const METRICS: MetricConfig[] = [
  { key: 'netWorth', label: 'Net Worth', color: '#1e3a5f', formatValue: dollarFormat },
  { key: 'tspBalance', label: 'TSP Balance', color: '#22c55e', formatValue: dollarFormat },
  { key: 'liquidSavings', label: 'Savings', color: '#3b82f6', formatValue: dollarFormat },
  { key: 'totalDebt', label: 'Total Debt', color: '#ef4444', formatValue: dollarFormat },
  { key: 'emergencyFundMonths', label: 'EF Months', color: '#eab308', formatValue: monthsFormat },
];

/** Look up MetricConfig by key. */
export function getMetricConfig(key: ChartMetric): MetricConfig {
  return METRICS.find((m) => m.key === key) ?? METRICS[0];
}

// --- Formatters ---

/** Compact dollar formatting: $0, $1.5K, $250K, $1.2M. */
export function formatDollarCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return '$0';
  if (abs >= 1_000_000) return `$${d3Format('.3~s')(value)}`.replace('G', 'B');
  if (abs >= 1_000) return `$${d3Format('.3~s')(value)}`;
  return `$${Math.round(value)}`;
}

/** Format month number as year label: "Yr 1", "Yr 5", etc. */
export function formatMonthLabel(month: number): string {
  return `Yr ${Math.ceil(month / 12)}`;
}

/** Generate year tick values for the X-axis. */
export function generateYearTicks(maxMonth: number): number[] {
  const ticks: number[] = [];
  const years = [1, 5, 10, 15, 20, 25, 30, 35, 40];
  for (const yr of years) {
    const month = yr * 12;
    if (month <= maxMonth) ticks.push(month);
  }
  return ticks;
}

// --- Scales ---

type Projections = SimulationResult['projections'];

/** Create X scale mapping month number to pixel position. */
export function createXScale(projections: Projections, innerWidth: number) {
  const first = projections[0]?.month ?? 1;
  const last = projections[projections.length - 1]?.month ?? 480;
  return scaleLinear().domain([first, last]).range([0, innerWidth]);
}

/** Create Y scale for the selected metric with 10% padding above max. */
export function createYScale(
  projections: Projections,
  metricKey: ChartMetric,
  innerHeight: number,
) {
  let min = Infinity;
  let max = -Infinity;

  for (const p of projections) {
    const band = p[metricKey];
    if (band.p10 < min) min = band.p10;
    if (band.p90 > max) max = band.p90;
  }

  // Ensure we always include 0 for financial metrics
  if (metricKey !== 'emergencyFundMonths') {
    min = Math.min(min, 0);
  }

  // Add 10% padding above max
  const padding = (max - min) * 0.1;
  max += padding;

  return scaleLinear().domain([min, max]).range([innerHeight, 0]).nice();
}

// --- Dimensions ---

const CHART_HEIGHT = 400;
const MARGIN = { top: 20, right: 20, bottom: 40, left: 65 };

/** Compute chart dimensions from container width. */
export function getDimensions(containerWidth: number): ChartDimensions {
  const width = containerWidth;
  const height = CHART_HEIGHT;
  return {
    width,
    height,
    margin: MARGIN,
    innerWidth: Math.max(0, width - MARGIN.left - MARGIN.right),
    innerHeight: Math.max(0, height - MARGIN.top - MARGIN.bottom),
  };
}
