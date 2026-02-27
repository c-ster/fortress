import { useFinancialStore } from '../../stores/financial-state';
import { FormSection } from '../shared/FormSection';
import { NumberInput } from '../shared/NumberInput';
import { SelectInput } from '../shared/SelectInput';
import { TextInput } from '../shared/TextInput';
import { formatPercent } from '../../utils/format-currency';
import type { Allotment } from '@fortress/types';

const SGLI_OPTIONS = [
  { value: '0', label: '$0 — No coverage' },
  { value: '50000', label: '$50,000' },
  { value: '100000', label: '$100,000' },
  { value: '200000', label: '$200,000' },
  { value: '300000', label: '$300,000' },
  { value: '400000', label: '$400,000' },
  { value: '500000', label: '$500,000 — Maximum' },
];

const ALLOTMENT_DEST_OPTIONS = [
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
  { value: 'family', label: 'Family Support' },
  { value: 'other', label: 'Other' },
];

export function StepDeductions() {
  const { state, setDeductions, addAllotment, removeAllotment } = useFinancialStore();
  const { deductions } = state;

  const handleAddAllotment = () => {
    const allotment: Allotment = {
      id: crypto.randomUUID(),
      name: '',
      amount: 0,
      destination: 'savings',
    };
    addAllotment(allotment);
  };

  // Update allotment fields by rebuilding the allotments array
  const handleAllotmentChange = (id: string, field: keyof Allotment, value: string | number) => {
    const updated = deductions.allotments.map((a) =>
      a.id === id ? { ...a, [field]: value } : a,
    );
    setDeductions({ allotments: updated });
  };

  return (
    <div className="space-y-6">
      <FormSection title="Taxes" description="Monthly tax withholdings from your LES.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberInput
            label="Federal Tax"
            value={deductions.federalTax}
            onChange={(v) => setDeductions({ federalTax: v })}
          />
          <NumberInput
            label="State Tax"
            value={deductions.stateTax}
            onChange={(v) => setDeductions({ stateTax: v })}
          />
          <NumberInput
            label="FICA (Social Security + Medicare)"
            value={deductions.fica}
            onChange={(v) => setDeductions({ fica: v })}
          />
        </div>
      </FormSection>

      <FormSection title="Insurance & Retirement">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="SGLI Monthly Premium"
            value={deductions.sgli}
            onChange={(v) => setDeductions({ sgli: v })}
          />
          <SelectInput
            label="SGLI Coverage Amount"
            value={String(deductions.sgliCoverage)}
            onChange={(v) => setDeductions({ sgliCoverage: Number(v) })}
            options={SGLI_OPTIONS}
          />
          <NumberInput
            label="TSP Traditional"
            value={deductions.tspTraditional}
            onChange={(v) => setDeductions({ tspTraditional: v })}
            helpText="Pre-tax TSP contribution"
          />
          <NumberInput
            label="TSP Roth"
            value={deductions.tspRoth}
            onChange={(v) => setDeductions({ tspRoth: v })}
            helpText="After-tax TSP contribution"
          />
          <NumberInput
            label="Tricare"
            value={deductions.tricare}
            onChange={(v) => setDeductions({ tricare: v })}
          />
          <NumberInput
            label="Other Deductions"
            value={deductions.otherDeductions}
            onChange={(v) => setDeductions({ otherDeductions: v })}
          />
        </div>

        {/* TSP contribution % */}
        {deductions.tspContributionPct > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100 text-sm">
            <span className="text-gray-400">TSP Contribution Rate: </span>
            <span
              className={`font-semibold ${
                deductions.tspContributionPct >= 0.05
                  ? 'text-fortress-green'
                  : 'text-fortress-yellow'
              }`}
            >
              {formatPercent(deductions.tspContributionPct * 100)}
            </span>
            {deductions.tspContributionPct < 0.05 && (
              <span className="text-xs text-fortress-yellow ml-2">
                Below 5% — not capturing full BRS match
              </span>
            )}
          </div>
        )}
      </FormSection>

      <FormSection
        title="Allotments"
        description="Automatic payments from your pay to savings, investments, or family."
      >
        {deductions.allotments.length === 0 && (
          <p className="text-sm text-gray-400 mb-4">
            No allotments added. Allotments are a great way to automate savings.
          </p>
        )}

        <div className="space-y-3">
          {deductions.allotments.map((allotment) => (
            <div
              key={allotment.id}
              className="border border-gray-200 rounded-md p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <TextInput
                label="Name"
                value={allotment.name}
                onChange={(v) => handleAllotmentChange(allotment.id, 'name', v)}
                placeholder="e.g., USAA Savings"
              />
              <NumberInput
                label="Amount"
                value={allotment.amount}
                onChange={(v) => handleAllotmentChange(allotment.id, 'amount', v)}
              />
              <SelectInput
                label="Destination"
                value={allotment.destination}
                onChange={(v) => handleAllotmentChange(allotment.id, 'destination', v)}
                options={ALLOTMENT_DEST_OPTIONS}
              />
              <button
                type="button"
                onClick={() => removeAllotment(allotment.id)}
                className="text-fortress-red hover:text-fortress-red/80 text-sm font-medium py-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddAllotment}
          className="mt-4 text-sm font-medium text-fortress-navy hover:text-fortress-navy/80"
        >
          + Add Allotment
        </button>
      </FormSection>
    </div>
  );
}
