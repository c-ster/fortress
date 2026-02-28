/**
 * Scenario controls form for the financial simulator.
 *
 * Reuses NumberInput, SelectInput, and FormSection from intake wizard.
 * Sliders use native <input type="range"> with onInput for preview (50 iter)
 * and onChange for full simulation (500 iter via debounce).
 */

import type { SimulationScenario } from '@fortress/types';
import { NumberInput } from '../shared/NumberInput';
import { SelectInput } from '../shared/SelectInput';
import { FormSection } from '../shared/FormSection';

interface ScenarioControlsProps {
  scenario: SimulationScenario;
  onUpdate: (partial: Partial<SimulationScenario>) => void;
  onPreview: (partial: Partial<SimulationScenario>) => void;
  isRunning: boolean;
  basePay: number;
}

const DEBT_STRATEGY_OPTIONS = [
  { value: 'minimum', label: 'Minimum Payments Only' },
  { value: 'avalanche', label: 'Avalanche (Highest APR First)' },
  { value: 'snowball', label: 'Snowball (Lowest Balance First)' },
];

const HOUSING_OPTIONS = [
  { value: 'on_base', label: 'On Base' },
  { value: 'at_bah', label: 'At BAH' },
  { value: 'below_bah', label: 'Below BAH' },
];

const HORIZON_OPTIONS = [
  { value: '120', label: '10 Years' },
  { value: '240', label: '20 Years' },
  { value: '480', label: '40 Years' },
];

export function ScenarioControls({
  scenario,
  onUpdate,
  onPreview,
  isRunning,
  basePay,
}: ScenarioControlsProps) {
  const tspPct = Math.round(scenario.tspContributionPct * 100);
  const tspMonthly = Math.round(scenario.tspContributionPct * basePay);
  const lifestylePct = Math.round(scenario.lifestyleAdjustmentPct * 100);

  return (
    <div className="space-y-4">
      {/* Retirement Savings */}
      <FormSection title="Retirement Savings" description="TSP contribution and savings allotment">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fortress-slate mb-1">
              TSP Contribution: {tspPct}%
              {basePay > 0 && (
                <span className="text-gray-400 font-normal"> (${tspMonthly}/mo)</span>
              )}
            </label>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={tspPct}
              onInput={(e) =>
                onPreview({ tspContributionPct: Number(e.currentTarget.value) / 100 })
              }
              onChange={(e) =>
                onUpdate({ tspContributionPct: Number(e.currentTarget.value) / 100 })
              }
              disabled={isRunning}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                accent-fortress-navy disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span className="text-fortress-green font-medium">5% (BRS match)</span>
              <span>20%</span>
            </div>
          </div>

          <NumberInput
            label="Monthly Savings Allotment"
            value={scenario.monthlySavingsAllotment}
            onChange={(v) => onUpdate({ monthlySavingsAllotment: v })}
            min={0}
            max={5000}
            step={50}
            helpText="Auto-deposited to savings each month"
          />
        </div>
      </FormSection>

      {/* Debt Strategy */}
      <FormSection title="Debt Strategy" description="How to allocate debt payments">
        <div className="space-y-4">
          <SelectInput
            label="Payment Strategy"
            value={scenario.debtStrategy}
            onChange={(v) =>
              onUpdate({ debtStrategy: v as SimulationScenario['debtStrategy'] })
            }
            options={DEBT_STRATEGY_OPTIONS}
          />

          <NumberInput
            label="Extra Monthly Debt Payment"
            value={scenario.extraDebtPayment}
            onChange={(v) => onUpdate({ extraDebtPayment: v })}
            min={0}
            max={2000}
            step={25}
            helpText="Additional payment beyond minimums"
          />
        </div>
      </FormSection>

      {/* Housing */}
      <FormSection title="Housing" description="BAH usage and housing costs">
        <div className="space-y-4">
          <SelectInput
            label="Housing Choice"
            value={scenario.housingChoice}
            onChange={(v) =>
              onUpdate({ housingChoice: v as SimulationScenario['housingChoice'] })
            }
            options={HOUSING_OPTIONS}
          />

          {scenario.housingChoice === 'below_bah' && (
            <NumberInput
              label="Monthly BAH Savings"
              value={scenario.bahDelta}
              onChange={(v) => onUpdate({ bahDelta: v })}
              min={-500}
              max={500}
              step={25}
              helpText="Difference between BAH and actual housing cost"
            />
          )}
        </div>
      </FormSection>

      {/* Lifestyle & Timeline */}
      <FormSection title="Lifestyle & Timeline">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fortress-slate mb-1">
              Spending Reduction: {lifestylePct}%
            </label>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={lifestylePct}
              onInput={(e) =>
                onPreview({ lifestyleAdjustmentPct: Number(e.currentTarget.value) / 100 })
              }
              onChange={(e) =>
                onUpdate({ lifestyleAdjustmentPct: Number(e.currentTarget.value) / 100 })
              }
              disabled={isRunning}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                accent-fortress-navy disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0% (current)</span>
              <span>30%</span>
            </div>
          </div>

          <SelectInput
            label="Time Horizon"
            value={String(scenario.horizonMonths)}
            onChange={(v) => onUpdate({ horizonMonths: Number(v) })}
            options={HORIZON_OPTIONS}
          />
        </div>
      </FormSection>
    </div>
  );
}
