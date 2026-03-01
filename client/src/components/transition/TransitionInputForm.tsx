/**
 * Transition planning input form.
 * Collects separation type, timeline, civilian income expectations,
 * TSP strategy, and VA disability rating.
 */

import { FormSection } from '../shared/FormSection';
import { NumberInput } from '../shared/NumberInput';
import { SelectInput } from '../shared/SelectInput';
import type { TransitionInput, SeparationType, TspAction } from '@fortress/types';

interface TransitionInputFormProps {
  input: TransitionInput;
  onUpdate: (partial: Partial<TransitionInput>) => void;
  payGrade: string;
  yearsOfService: number;
  dependents: number;
  retirementSystem: string;
}

const SEPARATION_OPTIONS = [
  { value: 'ets', label: 'End of Service (ETS)' },
  { value: 'retirement', label: 'Retirement (20+ years)' },
  { value: 'medical', label: 'Medical Separation' },
];

const TSP_OPTIONS = [
  { value: 'leave', label: 'Leave in TSP' },
  { value: 'rollover_ira', label: 'Roll over to IRA' },
  { value: 'partial_withdrawal', label: 'Partial Withdrawal' },
];

const LUMP_SUM_OPTIONS = [
  { value: '0', label: 'No Lump Sum' },
  { value: '25', label: '25% Lump Sum' },
  { value: '50', label: '50% Lump Sum' },
];

const VA_RATING_OPTIONS = [
  { value: '0', label: '0% or None' },
  { value: '10', label: '10%' },
  { value: '20', label: '20%' },
  { value: '30', label: '30%' },
  { value: '40', label: '40%' },
  { value: '50', label: '50%' },
  { value: '60', label: '60%' },
  { value: '70', label: '70%' },
  { value: '80', label: '80%' },
  { value: '90', label: '90%' },
  { value: '100', label: '100%' },
];

export function TransitionInputForm({
  input,
  onUpdate,
  payGrade,
  yearsOfService,
  dependents,
  retirementSystem,
}: TransitionInputFormProps) {
  const systemLabel = retirementSystem === 'brs' ? 'BRS'
    : retirementSystem === 'legacy' ? 'Legacy (High-3)' : 'Unknown';

  return (
    <div className="space-y-4">
      {/* Auto-filled profile */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
          From Your Profile
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm text-fortress-slate">
          <span><span className="font-medium">Grade:</span> {payGrade}</span>
          <span><span className="font-medium">YOS:</span> {yearsOfService}</span>
          <span><span className="font-medium">Dependents:</span> {dependents}</span>
          <span><span className="font-medium">Retirement:</span> {systemLabel}</span>
        </div>
      </div>

      {/* Separation Info */}
      <FormSection title="Separation Info" description="Type and timeline for your transition.">
        <div className="space-y-4">
          <SelectInput
            label="Separation Type"
            value={input.separationType}
            onChange={(v) => onUpdate({ separationType: v as SeparationType })}
            options={SEPARATION_OPTIONS}
          />
          <NumberInput
            label="Months Until Separation"
            value={input.monthsUntilSeparation}
            onChange={(v) => onUpdate({ monthsUntilSeparation: v })}
            min={1}
            max={60}
            helpText="How many months until your separation/retirement date"
          />
        </div>
      </FormSection>

      {/* Post-Service Income */}
      <FormSection title="Post-Service Income" description="Expected civilian income and VA benefits.">
        <div className="space-y-4">
          <NumberInput
            label="Expected Civilian Income (Monthly)"
            value={input.expectedCivilianIncome}
            onChange={(v) => onUpdate({ expectedCivilianIncome: v })}
            min={0}
            max={30000}
            helpText="Monthly gross income from civilian employment"
          />
          <SelectInput
            label="VA Disability Rating"
            value={String(input.vaDisabilityRating)}
            onChange={(v) => onUpdate({ vaDisabilityRating: parseInt(v, 10) })}
            options={VA_RATING_OPTIONS}
            helpText="Expected or current VA disability rating"
          />
        </div>
      </FormSection>

      {/* TSP & Benefits */}
      <FormSection title="TSP & Benefits" description="Thrift Savings Plan and retirement options.">
        <div className="space-y-4">
          <SelectInput
            label="TSP Action"
            value={input.tspAction}
            onChange={(v) => onUpdate({ tspAction: v as TspAction })}
            options={TSP_OPTIONS}
            helpText="What to do with your TSP balance at separation"
          />
          {input.tspAction === 'partial_withdrawal' && (
            <NumberInput
              label="Withdrawal Percentage"
              value={input.tspWithdrawalPct}
              onChange={(v) => onUpdate({ tspWithdrawalPct: v })}
              min={0}
              max={100}
              helpText="Percentage of TSP balance to withdraw"
            />
          )}
          {input.separationType === 'retirement' && retirementSystem === 'brs' && (
            <SelectInput
              label="BRS Lump Sum Option"
              value={String(input.brsLumpSumPct)}
              onChange={(v) => onUpdate({ brsLumpSumPct: parseInt(v, 10) })}
              options={LUMP_SUM_OPTIONS}
              helpText="Trade portion of monthly retirement pay for a lump sum"
            />
          )}
        </div>
      </FormSection>

      {/* Healthcare */}
      <FormSection title="Healthcare" description="Estimated civilian health insurance costs.">
        <NumberInput
          label="Civilian Health Insurance (Monthly)"
          value={input.civilianHealthInsuranceCost}
          onChange={(v) => onUpdate({ civilianHealthInsuranceCost: v })}
          min={0}
          max={3000}
          helpText="Estimated monthly premium for civilian health coverage"
        />
      </FormSection>
    </div>
  );
}
