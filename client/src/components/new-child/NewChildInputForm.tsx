/**
 * New child planner input form.
 * Collects timeline, expected expenses, and benefit elections.
 */

import { FormSection } from '../shared/FormSection';
import { NumberInput } from '../shared/NumberInput';
import { CheckboxInput } from '../shared/CheckboxInput';
import type { NewChildInput } from '@fortress/types';

interface NewChildInputFormProps {
  input: NewChildInput;
  onUpdate: (partial: Partial<NewChildInput>) => void;
  payGrade: string;
  dependents: number;
  dutyStation: string;
}

export function NewChildInputForm({
  input,
  onUpdate,
  payGrade,
  dependents,
  dutyStation,
}: NewChildInputFormProps) {
  return (
    <div className="space-y-4">
      {/* Auto-filled profile */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
          From Your Profile
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm text-fortress-slate">
          <span><span className="font-medium">Grade:</span> {payGrade}</span>
          <span><span className="font-medium">Dependents:</span> {dependents}</span>
          <span className="col-span-2">
            <span className="font-medium">Duty Station:</span> {dutyStation || 'Not set'}
          </span>
        </div>
        {dependents === 0 && (
          <p className="text-xs text-fortress-green mt-2 font-medium">
            First dependent — BAH increase applies!
          </p>
        )}
      </div>

      {/* Timeline */}
      <FormSection title="Timeline" description="When do you expect the new arrival?">
        <NumberInput
          label="Months Until Expected Date"
          value={input.expectedMonth}
          onChange={(v) => onUpdate({ expectedMonth: v })}
          min={1}
          max={12}
          helpText="How many months until the expected birth or adoption"
        />
      </FormSection>

      {/* Expenses */}
      <FormSection title="Expected Expenses" description="Estimated new monthly costs.">
        <div className="space-y-4">
          <NumberInput
            label="Current Childcare (Monthly)"
            value={input.currentChildcare}
            onChange={(v) => onUpdate({ currentChildcare: v })}
            min={0}
            max={5000}
            helpText="What you currently pay for childcare (if any)"
          />
          <NumberInput
            label="New Childcare Cost (Monthly)"
            value={input.estimatedNewChildcare}
            onChange={(v) => onUpdate({ estimatedNewChildcare: v })}
            min={0}
            max={5000}
            helpText="Additional childcare cost for the new child"
          />
          <NumberInput
            label="Supplies & Gear (Monthly)"
            value={input.estimatedSupplies}
            onChange={(v) => onUpdate({ estimatedSupplies: v })}
            min={0}
            max={2000}
            helpText="Diapers, formula, clothing, and other supplies"
          />
        </div>
      </FormSection>

      {/* Benefits */}
      <FormSection title="Benefit Elections" description="Optional benefit enrollments.">
        <div className="space-y-3">
          <CheckboxInput
            label="Enroll/Update Spouse FSGLI"
            checked={input.planFSGLI}
            onChange={(v) => onUpdate({ planFSGLI: v })}
            helpText="Family SGLI coverage for your spouse (~$10/mo)"
          />
          <CheckboxInput
            label="Use Dependent Care FSA"
            checked={input.planDepCare}
            onChange={(v) => onUpdate({ planDepCare: v })}
            helpText="Save on taxes for childcare expenses (up to $5,000/yr)"
          />
        </div>
      </FormSection>
    </div>
  );
}
