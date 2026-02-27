import { useEffect, useState } from 'react';
import { useFinancialStore } from '../../stores/financial-state';
import { FormSection } from '../shared/FormSection';
import { NumberInput } from '../shared/NumberInput';
import { lookupAllPay } from '../../utils/pay-tables';
import { formatCurrency } from '../../utils/format-currency';

export function StepIncome() {
  const { state, setIncome } = useFinancialStore();
  const { income, military } = state;
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());

  // Auto-fill from pay tables when military info changes
  useEffect(() => {
    const { payGrade, yearsOfService, dutyStation, dependents } = military;
    if (!payGrade || payGrade === 'E1') return; // Skip default

    lookupAllPay(payGrade, yearsOfService, dutyStation, dependents).then((result) => {
      const updates: Partial<typeof income> = {};
      const filled = new Set<string>();

      if (result.basePay !== null) {
        updates.basePay = result.basePay;
        filled.add('basePay');
      }
      updates.bas = result.bas;
      filled.add('bas');

      if (result.bah !== null) {
        updates.bah = result.bah;
        filled.add('bah');
      }

      setIncome(updates);
      setAutoFilled(filled);
    });
  }, [military.payGrade, military.yearsOfService, military.dutyStation, military.dependents]);

  const handleChange = (field: string, value: number) => {
    setIncome({ [field]: value });
    // Clear auto-filled indicator when user manually edits
    if (autoFilled.has(field)) {
      setAutoFilled((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <FormSection
        title="Monthly Income"
        description="Your monthly pay and allowances. Values auto-filled from 2025 DFAS pay tables can be overridden."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="Base Pay"
            value={income.basePay}
            onChange={(v) => handleChange('basePay', v)}
            autoFilled={autoFilled.has('basePay')}
          />
          <NumberInput
            label="BAH (Housing Allowance)"
            value={income.bah}
            onChange={(v) => handleChange('bah', v)}
            autoFilled={autoFilled.has('bah')}
            helpText={
              !autoFilled.has('bah') && military.dutyStation
                ? 'ZIP not in table — enter from your LES'
                : undefined
            }
          />
          <NumberInput
            label="BAS (Subsistence)"
            value={income.bas}
            onChange={(v) => handleChange('bas', v)}
            autoFilled={autoFilled.has('bas')}
          />
          <NumberInput
            label="COLA"
            value={income.cola}
            onChange={(v) => handleChange('cola', v)}
            helpText="Check DFAS for your location's COLA rate"
          />
          <NumberInput
            label="Special Pay"
            value={income.specialPay}
            onChange={(v) => handleChange('specialPay', v)}
            helpText="Flight pay, hazardous duty, etc."
          />
          <NumberInput
            label="Other Income"
            value={income.otherIncome}
            onChange={(v) => handleChange('otherIncome', v)}
            helpText="Side income, spouse income, etc."
          />
        </div>

        {/* Computed totals */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Total Gross</span>
              <p className="font-semibold text-fortress-navy">{formatCurrency(income.totalGross)}</p>
            </div>
            <div>
              <span className="text-gray-400">Taxable</span>
              <p className="font-semibold">{formatCurrency(income.totalTaxable)}</p>
            </div>
            <div>
              <span className="text-gray-400">Non-Taxable</span>
              <p className="font-semibold">{formatCurrency(income.totalNonTaxable)}</p>
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
}
