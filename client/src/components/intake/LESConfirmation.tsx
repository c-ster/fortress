import { useState, useMemo } from 'react';
import { NumberInput } from '../shared/NumberInput';
import { FormSection } from '../shared/FormSection';
import { formatCurrency } from '../../utils/format-currency';
import type { LESParseResult, LESFieldResult, FinancialState } from '@fortress/types';

interface LESConfirmationProps {
  result: LESParseResult;
  existingState: FinancialState;
  onConfirm: (fields: LESFieldResult[]) => void;
  onCancel: () => void;
}

/** All extractable LES fields with display metadata */
const FIELD_META: {
  field: string;
  label: string;
  section: 'income' | 'deductions';
  stateKey: string;
}[] = [
  { field: 'basePay', label: 'Base Pay', section: 'income', stateKey: 'income.basePay' },
  { field: 'bah', label: 'BAH (Housing)', section: 'income', stateKey: 'income.bah' },
  { field: 'bas', label: 'BAS (Subsistence)', section: 'income', stateKey: 'income.bas' },
  { field: 'cola', label: 'COLA', section: 'income', stateKey: 'income.cola' },
  { field: 'federalTax', label: 'Federal Tax', section: 'deductions', stateKey: 'deductions.federalTax' },
  { field: 'stateTax', label: 'State Tax', section: 'deductions', stateKey: 'deductions.stateTax' },
  { field: 'fica', label: 'FICA / Social Security', section: 'deductions', stateKey: 'deductions.fica' },
  { field: 'sgli', label: 'SGLI', section: 'deductions', stateKey: 'deductions.sgli' },
  { field: 'tspContribution', label: 'TSP Contribution', section: 'deductions', stateKey: 'deductions.tspTraditional' },
];

function getExistingValue(state: FinancialState, stateKey: string): number {
  const [section, key] = stateKey.split('.');
  const sectionObj = state[section as keyof FinancialState];
  if (typeof sectionObj === 'object' && sectionObj !== null && !Array.isArray(sectionObj)) {
    return (sectionObj as Record<string, number>)[key] ?? 0;
  }
  return 0;
}

function confidenceBadge(confidence: number) {
  if (confidence >= 0.9) {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-fortress-green/20
        text-fortress-green">
        High
      </span>
    );
  }
  if (confidence >= 0.7) {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-fortress-yellow/20
        text-fortress-yellow">
        Review
      </span>
    );
  }
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-fortress-red/20
      text-fortress-red">
      Verify
    </span>
  );
}

export function LESConfirmation({
  result,
  existingState,
  onConfirm,
  onCancel,
}: LESConfirmationProps) {
  // Build editable field values: start from extracted values
  const extractedMap = useMemo(() => {
    const map = new Map<string, LESFieldResult>();
    for (const f of result.fields) {
      map.set(f.field, f);
    }
    return map;
  }, [result.fields]);

  // Per-field editable value + source choice (for conflicts)
  const [editedValues, setEditedValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const meta of FIELD_META) {
      const extracted = extractedMap.get(meta.field);
      initial[meta.field] = extracted?.value ?? 0;
    }
    return initial;
  });

  // Track which source the user chose for conflict fields
  const [sourceChoice, setSourceChoice] = useState<Record<string, 'les' | 'existing'>>(() => {
    const choices: Record<string, 'les' | 'existing'> = {};
    for (const meta of FIELD_META) {
      choices[meta.field] = 'les'; // Default to LES values
    }
    return choices;
  });

  const handleValueChange = (field: string, value: number) => {
    setEditedValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSourceToggle = (field: string, source: 'les' | 'existing') => {
    setSourceChoice((prev) => ({ ...prev, [field]: source }));
    const meta = FIELD_META.find((m) => m.field === field)!;
    if (source === 'existing') {
      setEditedValues((prev) => ({
        ...prev,
        [field]: getExistingValue(existingState, meta.stateKey),
      }));
    } else {
      const extracted = extractedMap.get(field);
      setEditedValues((prev) => ({ ...prev, [field]: extracted?.value ?? 0 }));
    }
  };

  const handleConfirm = () => {
    // Build final fields from edited values
    const finalFields: LESFieldResult[] = FIELD_META
      .filter((meta) => editedValues[meta.field] > 0)
      .map((meta) => {
        const extracted = extractedMap.get(meta.field);
        return {
          field: meta.field,
          value: editedValues[meta.field],
          confidence: extracted?.confidence ?? 1.0, // Manual edits = full confidence
          source: result.extractionMethod,
          rawMatch: extracted?.rawMatch ?? 'user-edited',
        };
      });
    onConfirm(finalFields);
  };

  const incomeFields = FIELD_META.filter((m) => m.section === 'income');
  const deductionFields = FIELD_META.filter((m) => m.section === 'deductions');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-fortress-navy">
            Review Extracted Data
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Verify the values below and make corrections if needed.
          </p>
        </div>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            result.extractionMethod === 'text_layer'
              ? 'bg-fortress-green/20 text-fortress-green'
              : 'bg-fortress-yellow/20 text-fortress-yellow'
          }`}
        >
          {result.extractionMethod === 'text_layer' ? 'Text Layer' : 'OCR'}
        </span>
      </div>

      {/* Income section */}
      <FormSection title="Income" description="Pay and allowances from your LES">
        <div className="space-y-4">
          {incomeFields.map((meta) => (
            <FieldRow
              key={meta.field}
              meta={meta}
              extracted={extractedMap.get(meta.field)}
              existingValue={getExistingValue(existingState, meta.stateKey)}
              editedValue={editedValues[meta.field]}
              sourceChoice={sourceChoice[meta.field]}
              onValueChange={handleValueChange}
              onSourceToggle={handleSourceToggle}
            />
          ))}
        </div>
      </FormSection>

      {/* Deductions section */}
      <FormSection
        title="Deductions"
        description="Taxes, insurance, and retirement contributions"
        className="mt-4"
      >
        <div className="space-y-4">
          {deductionFields.map((meta) => (
            <FieldRow
              key={meta.field}
              meta={meta}
              extracted={extractedMap.get(meta.field)}
              existingValue={getExistingValue(existingState, meta.stateKey)}
              editedValue={editedValues[meta.field]}
              sourceChoice={sourceChoice[meta.field]}
              onValueChange={handleValueChange}
              onSourceToggle={handleSourceToggle}
            />
          ))}
        </div>
      </FormSection>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleConfirm}
          className="bg-fortress-navy text-white px-6 py-2.5 rounded-md text-sm
            font-medium hover:bg-fortress-navy/90 transition-colors"
        >
          Confirm &amp; Continue
        </button>
        <button
          onClick={onCancel}
          className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-md text-sm
            font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Your LES data stays on this device and is never sent to any server.
      </p>
    </div>
  );
}

// --- Field row sub-component ---

interface FieldRowProps {
  meta: (typeof FIELD_META)[number];
  extracted: LESFieldResult | undefined;
  existingValue: number;
  editedValue: number;
  sourceChoice: 'les' | 'existing';
  onValueChange: (field: string, value: number) => void;
  onSourceToggle: (field: string, source: 'les' | 'existing') => void;
}

function FieldRow({
  meta,
  extracted,
  existingValue,
  editedValue,
  sourceChoice,
  onValueChange,
  onSourceToggle,
}: FieldRowProps) {
  const hasConflict = extracted && existingValue > 0 && existingValue !== extracted.value;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {extracted ? (
          confidenceBadge(extracted.confidence)
        ) : (
          <span className="text-xs text-gray-400">Not detected</span>
        )}
      </div>

      {/* Conflict resolution */}
      {hasConflict && (
        <div className="bg-fortress-yellow/10 border border-fortress-yellow/30 rounded
          px-3 py-2 mb-2 text-xs">
          <p className="text-fortress-slate font-medium mb-1">
            Different value exists:
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name={`source-${meta.field}`}
                checked={sourceChoice === 'les'}
                onChange={() => onSourceToggle(meta.field, 'les')}
                className="accent-fortress-navy"
              />
              <span>
                LES: <strong>{formatCurrency(extracted!.value)}</strong>
              </span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name={`source-${meta.field}`}
                checked={sourceChoice === 'existing'}
                onChange={() => onSourceToggle(meta.field, 'existing')}
                className="accent-fortress-navy"
              />
              <span>
                Current: <strong>{formatCurrency(existingValue)}</strong>
              </span>
            </label>
          </div>
        </div>
      )}

      <NumberInput
        label={meta.label}
        value={editedValue}
        onChange={(val) => onValueChange(meta.field, val)}
        autoFilled={!!extracted && sourceChoice === 'les'}
      />
    </div>
  );
}
