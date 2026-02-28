/**
 * PCS move parameter input form.
 * Collects ZIP codes, distance, weight, move type, and logistics details.
 * Reuses shared FormSection, NumberInput, and SelectInput components.
 */

import { FormSection } from '../shared/FormSection';
import { NumberInput } from '../shared/NumberInput';
import { SelectInput } from '../shared/SelectInput';
import type { PcsInput } from '@fortress/types';

interface PcsInputFormProps {
  input: PcsInput;
  onUpdate: (partial: Partial<PcsInput>) => void;
  currentStation: string | null;
  newStation: string | null;
  isCalculating: boolean;
}

const MOVE_TYPE_OPTIONS = [
  { value: 'tmo', label: 'TMO (Government-Managed)' },
  { value: 'dity', label: 'DITY / PPM (Self-Move)' },
  { value: 'partial_dity', label: 'Partial DITY' },
];

function ZipInput({
  label,
  value,
  onChange,
  stationName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  stationName: string | null;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-fortress-slate mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        maxLength={5}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 5);
          onChange(v);
        }}
        placeholder="00000"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-fortress-slate
          focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none"
      />
      {stationName && (
        <p className="text-xs text-fortress-green mt-1">{stationName}</p>
      )}
      {value.length === 5 && !stationName && (
        <p className="text-xs text-gray-400 mt-1">ZIP not in BAH table</p>
      )}
    </div>
  );
}

export function PcsInputForm({
  input,
  onUpdate,
  currentStation,
  newStation,
  isCalculating,
}: PcsInputFormProps) {
  return (
    <div className="space-y-4">
      {/* Auto-filled info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
          From Your Profile
        </p>
        <div className="flex gap-4 text-sm text-fortress-slate">
          <span>
            <span className="font-medium">Grade:</span> {input.payGrade}
          </span>
          <span>
            <span className="font-medium">Dependents:</span> {input.dependents}
          </span>
        </div>
      </div>

      {/* Move Details */}
      <FormSection title="Move Details" description="Where and how you're moving.">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ZipInput
              label="Current ZIP"
              value={input.currentZip}
              onChange={(v) => onUpdate({ currentZip: v })}
              stationName={currentStation}
            />
            <ZipInput
              label="New ZIP"
              value={input.newZip}
              onChange={(v) => onUpdate({ newZip: v })}
              stationName={newStation}
            />
          </div>

          <div>
            <label
              htmlFor="move-date"
              className="block text-sm font-medium text-fortress-slate mb-1"
            >
              Move Date
            </label>
            <input
              id="move-date"
              type="date"
              value={input.moveDate}
              onChange={(e) => onUpdate({ moveDate: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-fortress-slate
                focus:border-fortress-navy focus:ring-1 focus:ring-fortress-navy outline-none"
            />
          </div>

          <NumberInput
            label="Distance"
            value={input.distanceMiles}
            onChange={(v) => onUpdate({ distanceMiles: v })}
            prefix=""
            suffix="mi"
            min={0}
            max={10000}
            helpText="Driving distance between stations"
          />

          <SelectInput
            label="Move Type"
            value={input.moveType}
            onChange={(v) => onUpdate({ moveType: v as PcsInput['moveType'] })}
            options={MOVE_TYPE_OPTIONS}
            helpText="TMO = government ships your goods. DITY/PPM = you move yourself for incentive pay."
          />
        </div>
      </FormSection>

      {/* Logistics */}
      <FormSection title="Logistics" description="Household goods and temporary lodging.">
        <div className="space-y-4">
          <NumberInput
            label="Estimated Weight"
            value={input.estimatedWeight}
            onChange={(v) => onUpdate({ estimatedWeight: v })}
            prefix=""
            suffix="lbs"
            min={0}
            max={20000}
            helpText="Household goods weight (avg: E5 w/deps ~8,000 lbs)"
          />

          <NumberInput
            label="Storage Months"
            value={input.storageMonths}
            onChange={(v) => onUpdate({ storageMonths: v })}
            prefix=""
            min={0}
            max={6}
            step={1}
            helpText="Storage in Transit (SIT), max 6 months"
          />

          <NumberInput
            label="TLE Days"
            value={input.tleDays}
            onChange={(v) => onUpdate({ tleDays: v })}
            prefix=""
            min={0}
            max={10}
            step={1}
            helpText="Temporary Lodging Expense days (max 10)"
          />
        </div>
      </FormSection>

      {/* Calculating indicator */}
      {isCalculating && (
        <p className="text-xs text-gray-400 text-center animate-pulse">
          Calculating costs...
        </p>
      )}
    </div>
  );
}
