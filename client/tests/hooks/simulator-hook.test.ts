import { describe, it, expect } from 'vitest';
import type { SimulationScenario } from '@fortress/types';
import { buildDefaultScenario, mergeScenario } from '../../src/hooks/useSimulator';

// ============================================================
// buildDefaultScenario
// ============================================================

describe('buildDefaultScenario', () => {
  it('uses provided TSP percentage when > 0', () => {
    const scenario = buildDefaultScenario(0.1);
    expect(scenario.tspContributionPct).toBe(0.1);
  });

  it('falls back to 5% when TSP is 0', () => {
    const scenario = buildDefaultScenario(0);
    expect(scenario.tspContributionPct).toBe(0.05);
  });

  it('falls back to 5% when TSP is negative', () => {
    const scenario = buildDefaultScenario(-0.1);
    expect(scenario.tspContributionPct).toBe(0.05);
  });

  it('sets default debt strategy to avalanche', () => {
    const scenario = buildDefaultScenario(0.05);
    expect(scenario.debtStrategy).toBe('avalanche');
  });

  it('sets default housing choice to at_bah', () => {
    const scenario = buildDefaultScenario(0.05);
    expect(scenario.housingChoice).toBe('at_bah');
  });

  it('sets 480 month (40 year) horizon', () => {
    const scenario = buildDefaultScenario(0.05);
    expect(scenario.horizonMonths).toBe(480);
  });

  it('sets 500 full iterations', () => {
    const scenario = buildDefaultScenario(0.05);
    expect(scenario.iterations).toBe(500);
  });

  it('has reasonable TSP return assumptions', () => {
    const scenario = buildDefaultScenario(0.05);
    expect(scenario.tspReturnMean).toBe(0.07);
    expect(scenario.tspReturnStdDev).toBe(0.15);
  });

  it('sets default monthly savings allotment to 200', () => {
    const scenario = buildDefaultScenario(0.05);
    expect(scenario.monthlySavingsAllotment).toBe(200);
  });

  it('returns a valid SimulationScenario with all required fields', () => {
    const scenario = buildDefaultScenario(0.08);
    const requiredKeys: (keyof SimulationScenario)[] = [
      'tspContributionPct',
      'monthlySavingsAllotment',
      'debtStrategy',
      'extraDebtPayment',
      'housingChoice',
      'bahDelta',
      'lifestyleAdjustmentPct',
      'horizonMonths',
      'iterations',
      'tspReturnMean',
      'tspReturnStdDev',
      'savingsReturnMean',
    ];
    for (const key of requiredKeys) {
      expect(scenario).toHaveProperty(key);
    }
  });
});

// ============================================================
// mergeScenario
// ============================================================

describe('mergeScenario', () => {
  const base = buildDefaultScenario(0.05);

  it('overrides a single field', () => {
    const merged = mergeScenario(base, { tspContributionPct: 0.15 });
    expect(merged.tspContributionPct).toBe(0.15);
    expect(merged.debtStrategy).toBe(base.debtStrategy);
  });

  it('overrides multiple fields', () => {
    const merged = mergeScenario(base, {
      debtStrategy: 'snowball',
      extraDebtPayment: 300,
      monthlySavingsAllotment: 500,
    });
    expect(merged.debtStrategy).toBe('snowball');
    expect(merged.extraDebtPayment).toBe(300);
    expect(merged.monthlySavingsAllotment).toBe(500);
  });

  it('preserves unchanged fields', () => {
    const merged = mergeScenario(base, { bahDelta: 100 });
    expect(merged.tspContributionPct).toBe(base.tspContributionPct);
    expect(merged.horizonMonths).toBe(base.horizonMonths);
    expect(merged.iterations).toBe(base.iterations);
    expect(merged.housingChoice).toBe(base.housingChoice);
  });

  it('can override iterations (for preview mode)', () => {
    const merged = mergeScenario(base, { iterations: 50 });
    expect(merged.iterations).toBe(50);
  });

  it('returns a new object (no mutation)', () => {
    const merged = mergeScenario(base, { tspContributionPct: 0.2 });
    expect(merged).not.toBe(base);
    expect(base.tspContributionPct).toBe(0.05);
  });

  it('handles empty partial gracefully', () => {
    const merged = mergeScenario(base, {});
    expect(merged).toEqual(base);
    expect(merged).not.toBe(base);
  });

  it('can switch housing choice and set bahDelta together', () => {
    const merged = mergeScenario(base, {
      housingChoice: 'below_bah',
      bahDelta: -200,
    });
    expect(merged.housingChoice).toBe('below_bah');
    expect(merged.bahDelta).toBe(-200);
  });

  it('can change horizon months', () => {
    const merged = mergeScenario(base, { horizonMonths: 120 });
    expect(merged.horizonMonths).toBe(120);
  });
});
