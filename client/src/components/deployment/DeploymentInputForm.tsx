/**
 * Deployment preparation input form.
 * Collects deployment length, spouse status, and financial adjustment estimates.
 */

import { FormSection } from '../shared/FormSection';
import { NumberInput } from '../shared/NumberInput';
import { SelectInput } from '../shared/SelectInput';
import type { DeploymentInput, DeploymentLength } from '@fortress/types';

interface DeploymentInputFormProps {
  input: DeploymentInput;
  onUpdate: (partial: Partial<DeploymentInput>) => void;
  payGrade: string;
  dependents: number;
}

const LENGTH_OPTIONS = [
  { value: 'short', label: 'Short (< 3 months)' },
  { value: 'medium', label: 'Medium (3–6 months)' },
  { value: 'long', label: 'Long (> 6 months)' },
];

export function DeploymentInputForm({
  input,
  onUpdate,
  payGrade,
  dependents,
}: DeploymentInputFormProps) {
  return (
    <div className="space-y-4">
      {/* Auto-filled info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
          From Your Profile
        </p>
        <div className="flex gap-4 text-sm text-fortress-slate">
          <span>
            <span className="font-medium">Grade:</span> {payGrade}
          </span>
          <span>
            <span className="font-medium">Dependents:</span> {dependents}
          </span>
        </div>
      </div>

      {/* Deployment Info */}
      <FormSection title="Deployment Info" description="Duration and family status.">
        <div className="space-y-4">
          <SelectInput
            label="Deployment Length"
            value={input.deploymentLength}
            onChange={(v) => onUpdate({ deploymentLength: v as DeploymentLength })}
            options={LENGTH_OPTIONS}
            helpText="Approximate duration — no specific dates stored (OPSEC)"
          />

          <div>
            <label className="block text-sm font-medium text-fortress-slate mb-2">
              Spouse Managing Finances?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onUpdate({ hasSpouse: true })}
                className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                  input.hasSpouse
                    ? 'bg-fortress-navy text-white border-fortress-navy'
                    : 'bg-white text-fortress-slate border-gray-300 hover:bg-gray-50'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ hasSpouse: false })}
                className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                  !input.hasSpouse
                    ? 'bg-fortress-navy text-white border-fortress-navy'
                    : 'bg-white text-fortress-slate border-gray-300 hover:bg-gray-50'
                }`}
              >
                No
              </button>
            </div>
          </div>
        </div>
      </FormSection>

      {/* Financial Adjustments */}
      <FormSection
        title="Financial Adjustments"
        description="Estimate income and expense changes during deployment."
      >
        <div className="space-y-4">
          {input.hasSpouse && (
            <NumberInput
              label="Spouse Monthly Income"
              value={input.spouseMonthlyIncome}
              onChange={(v) => onUpdate({ spouseMonthlyIncome: v })}
              min={0}
              max={20000}
              helpText="Current or expected spouse income during deployment"
            />
          )}

          <NumberInput
            label="Expected Monthly Expense Reduction"
            value={input.reducedExpenses}
            onChange={(v) => onUpdate({ reducedExpenses: v })}
            min={0}
            max={5000}
            helpText="Savings from reduced food, gas, entertainment while deployed"
          />
        </div>
      </FormSection>
    </div>
  );
}
