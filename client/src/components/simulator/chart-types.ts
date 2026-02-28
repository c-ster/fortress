/**
 * Type definitions for the simulator chart components.
 */

import type { SimulationResult } from '@fortress/types';

/** Metrics available for visualization in the fan chart. */
export type ChartMetric =
  | 'netWorth'
  | 'tspBalance'
  | 'liquidSavings'
  | 'totalDebt'
  | 'emergencyFundMonths';

/** Display configuration for a single metric. */
export interface MetricConfig {
  key: ChartMetric;
  label: string;
  color: string;
  formatValue: (v: number) => string;
}

/** Chart dimensions following the D3 margin convention. */
export interface ChartDimensions {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  innerWidth: number;
  innerHeight: number;
}

/** Props for the main SimulatorChart component. */
export interface SimulatorChartProps {
  result: SimulationResult;
  className?: string;
}
