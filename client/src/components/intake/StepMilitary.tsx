import { useFinancialStore } from '../../stores/financial-state';
import { FormSection } from '../shared/FormSection';
import { SelectInput } from '../shared/SelectInput';
import { TextInput } from '../shared/TextInput';
import { NumberInput } from '../shared/NumberInput';
import type { PayGrade } from '@fortress/types';

const PAY_GRADE_OPTIONS = [
  { value: '', label: 'Select pay grade...' },
  // Enlisted
  { value: 'E1', label: 'E-1 Private / Seaman Recruit' },
  { value: 'E2', label: 'E-2 Private / Seaman Apprentice' },
  { value: 'E3', label: 'E-3 PFC / Seaman' },
  { value: 'E4', label: 'E-4 SPC-CPL / Petty Officer 3rd' },
  { value: 'E5', label: 'E-5 SGT / Petty Officer 2nd' },
  { value: 'E6', label: 'E-6 SSG / Petty Officer 1st' },
  { value: 'E7', label: 'E-7 SFC / Chief Petty Officer' },
  { value: 'E8', label: 'E-8 MSG-1SG / Senior Chief' },
  { value: 'E9', label: 'E-9 SGM-CSM / Master Chief' },
  // Warrant Officer
  { value: 'W1', label: 'W-1 Warrant Officer 1' },
  { value: 'W2', label: 'W-2 Chief Warrant Officer 2' },
  { value: 'W3', label: 'W-3 Chief Warrant Officer 3' },
  { value: 'W4', label: 'W-4 Chief Warrant Officer 4' },
  { value: 'W5', label: 'W-5 Chief Warrant Officer 5' },
  // Officer
  { value: 'O1', label: 'O-1 2LT / ENS' },
  { value: 'O1E', label: 'O-1E (Prior Enlisted)' },
  { value: 'O2', label: 'O-2 1LT / LTJG' },
  { value: 'O2E', label: 'O-2E (Prior Enlisted)' },
  { value: 'O3', label: 'O-3 CPT / LT' },
  { value: 'O3E', label: 'O-3E (Prior Enlisted)' },
  { value: 'O4', label: 'O-4 MAJ / LCDR' },
  { value: 'O5', label: 'O-5 LTC / CDR' },
];

const COMPONENT_OPTIONS = [
  { value: 'active', label: 'Active Duty' },
  { value: 'reserve', label: 'Reserve' },
  { value: 'guard', label: 'National Guard' },
];

const RETIREMENT_OPTIONS = [
  { value: 'brs', label: 'Blended Retirement System (BRS)' },
  { value: 'legacy', label: 'Legacy High-3' },
  { value: 'unknown', label: 'Not Sure' },
];

export function StepMilitary() {
  const { state, setMilitary } = useFinancialStore();
  const { military } = state;

  return (
    <div className="space-y-6">
      <FormSection title="Service Information" description="Tell us about your military service.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectInput
            label="Pay Grade"
            value={military.payGrade}
            onChange={(v) => setMilitary({ payGrade: v as PayGrade })}
            options={PAY_GRADE_OPTIONS}
            required
          />
          <NumberInput
            label="Years of Service"
            value={military.yearsOfService}
            onChange={(v) => setMilitary({ yearsOfService: v })}
            prefix=""
            suffix="years"
            min={0}
            max={40}
            step={1}
          />
          <SelectInput
            label="Component"
            value={military.component}
            onChange={(v) => setMilitary({ component: v as 'active' | 'reserve' | 'guard' })}
            options={COMPONENT_OPTIONS}
          />
          <SelectInput
            label="Retirement System"
            value={military.retirementSystem}
            onChange={(v) =>
              setMilitary({ retirementSystem: v as 'brs' | 'legacy' | 'unknown' })
            }
            options={RETIREMENT_OPTIONS}
            helpText="Entered after Jan 2018? You're likely BRS."
          />
        </div>
      </FormSection>

      <FormSection title="Station & Family">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput
            label="Duty Station ZIP Code"
            value={military.dutyStation}
            onChange={(v) => setMilitary({ dutyStation: v.replace(/\D/g, '').slice(0, 5) })}
            placeholder="e.g., 92101"
            maxLength={5}
            helpText="Used to look up your BAH rate"
          />
          <NumberInput
            label="Number of Dependents"
            value={military.dependents}
            onChange={(v) => setMilitary({ dependents: Math.round(v) })}
            prefix=""
            min={0}
            max={20}
            step={1}
            helpText="Spouse and children"
          />
        </div>
      </FormSection>
    </div>
  );
}
