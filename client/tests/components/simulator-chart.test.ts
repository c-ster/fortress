import { describe, it, expect } from 'vitest';
import type { SimulationResult, PercentileBand } from '@fortress/types';
import {
  METRICS,
  createXScale,
  createYScale,
  formatDollarCompact,
  formatMonthLabel,
  generateYearTicks,
  getDimensions,
  getMetricConfig,
} from '../../src/components/simulator/chart-scales';
import type { ChartMetric } from '../../src/components/simulator/chart-types';

// --- Test Data Factory ---

function makeBand(base: number, spread: number = 100): PercentileBand {
  return {
    p10: base - spread * 2,
    p25: base - spread,
    p50: base,
    p75: base + spread,
    p90: base + spread * 2,
  };
}

function makeProjections(months: number): SimulationResult['projections'] {
  return Array.from({ length: months }, (_, i) => ({
    month: i + 1,
    netWorth: makeBand(10000 + i * 500, 2000),
    tspBalance: makeBand(5000 + i * 200, 1000),
    liquidSavings: makeBand(3000 + i * 100, 500),
    totalDebt: makeBand(Math.max(0, 15000 - i * 150), 1000),
    emergencyFundMonths: makeBand(1 + i * 0.05, 0.5),
  }));
}

// ============================================================
// METRICS Configuration
// ============================================================

describe('METRICS', () => {
  it('has 5 entries matching all ChartMetric keys', () => {
    const keys: ChartMetric[] = [
      'netWorth', 'tspBalance', 'liquidSavings', 'totalDebt', 'emergencyFundMonths',
    ];
    expect(METRICS).toHaveLength(5);
    for (const key of keys) {
      expect(METRICS.find((m) => m.key === key)).toBeDefined();
    }
  });

  it('each metric has a label, color, and formatValue', () => {
    for (const m of METRICS) {
      expect(m.label).toBeTruthy();
      expect(m.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(typeof m.formatValue).toBe('function');
    }
  });
});

describe('getMetricConfig', () => {
  it('returns config for a known key', () => {
    const config = getMetricConfig('tspBalance');
    expect(config.key).toBe('tspBalance');
    expect(config.label).toBe('TSP Balance');
  });

  it('returns first metric as fallback for unknown key', () => {
    const config = getMetricConfig('unknown' as ChartMetric);
    expect(config.key).toBe(METRICS[0].key);
  });
});

// ============================================================
// Formatters
// ============================================================

describe('formatDollarCompact', () => {
  it('formats zero as $0', () => {
    expect(formatDollarCompact(0)).toBe('$0');
  });

  it('formats small values as whole dollars', () => {
    expect(formatDollarCompact(500)).toBe('$500');
  });

  it('formats thousands with K suffix', () => {
    const result = formatDollarCompact(1500);
    expect(result).toContain('$');
    expect(result).toContain('k');
  });

  it('formats millions with M suffix', () => {
    const result = formatDollarCompact(1_200_000);
    expect(result).toContain('$');
    expect(result).toContain('M');
  });

  it('formats 250K correctly', () => {
    const result = formatDollarCompact(250_000);
    expect(result).toContain('$');
    expect(result).toContain('k');
  });
});

describe('formatMonthLabel', () => {
  it('converts month 12 to "Yr 1"', () => {
    expect(formatMonthLabel(12)).toBe('Yr 1');
  });

  it('converts month 60 to "Yr 5"', () => {
    expect(formatMonthLabel(60)).toBe('Yr 5');
  });

  it('converts month 480 to "Yr 40"', () => {
    expect(formatMonthLabel(480)).toBe('Yr 40');
  });

  it('rounds up partial years', () => {
    expect(formatMonthLabel(1)).toBe('Yr 1');
    expect(formatMonthLabel(13)).toBe('Yr 2');
  });
});

describe('generateYearTicks', () => {
  it('returns ticks up to the given max month', () => {
    const ticks = generateYearTicks(480);
    expect(ticks).toEqual([12, 60, 120, 180, 240, 300, 360, 420, 480]);
  });

  it('truncates ticks beyond maxMonth', () => {
    const ticks = generateYearTicks(60);
    expect(ticks).toEqual([12, 60]);
  });

  it('returns empty for very short horizon', () => {
    const ticks = generateYearTicks(6);
    expect(ticks).toEqual([]);
  });
});

// ============================================================
// Scales
// ============================================================

describe('createXScale', () => {
  it('maps first month to 0 and last month to innerWidth', () => {
    const projections = makeProjections(480);
    const scale = createXScale(projections, 700);
    expect(scale(1)).toBeCloseTo(0, 0);
    expect(scale(480)).toBeCloseTo(700, 0);
  });

  it('handles short horizons', () => {
    const projections = makeProjections(24);
    const scale = createXScale(projections, 500);
    expect(scale(1)).toBeCloseTo(0, 0);
    expect(scale(24)).toBeCloseTo(500, 0);
  });
});

describe('createYScale', () => {
  it('domain covers p10 min and p90 max with padding', () => {
    const projections = makeProjections(60);
    const scale = createYScale(projections, 'netWorth', 340);

    const domain = scale.domain();
    // p10 min should be covered (could be negative)
    const minP10 = Math.min(...projections.map((p) => p.netWorth.p10));
    const maxP90 = Math.max(...projections.map((p) => p.netWorth.p90));

    expect(domain[0]).toBeLessThanOrEqual(minP10);
    expect(domain[1]).toBeGreaterThanOrEqual(maxP90);
  });

  it('includes 0 in domain for financial metrics', () => {
    const projections = makeProjections(12);
    const scale = createYScale(projections, 'tspBalance', 340);
    const domain = scale.domain();
    expect(domain[0]).toBeLessThanOrEqual(0);
  });

  it('maps high values to low y (SVG inverted)', () => {
    const projections = makeProjections(60);
    const scale = createYScale(projections, 'netWorth', 340);
    const domain = scale.domain();
    expect(scale(domain[1])).toBeLessThan(scale(domain[0]));
  });
});

// ============================================================
// Dimensions
// ============================================================

describe('getDimensions', () => {
  it('computes correct innerWidth and innerHeight from margins', () => {
    const dims = getDimensions(800);
    expect(dims.width).toBe(800);
    expect(dims.height).toBe(400);
    expect(dims.innerWidth).toBe(800 - dims.margin.left - dims.margin.right);
    expect(dims.innerHeight).toBe(400 - dims.margin.top - dims.margin.bottom);
  });

  it('clamps inner dimensions to minimum 0', () => {
    const dims = getDimensions(10);
    expect(dims.innerWidth).toBeGreaterThanOrEqual(0);
    expect(dims.innerHeight).toBeGreaterThanOrEqual(0);
  });
});
