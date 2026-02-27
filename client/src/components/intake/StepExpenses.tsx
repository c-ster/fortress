import { useFinancialStore } from '../../stores/financial-state';
import { FormSection } from '../shared/FormSection';
import { NumberInput } from '../shared/NumberInput';
import { formatCurrency } from '../../utils/format-currency';

export function StepExpenses() {
  const { state, setExpenses } = useFinancialStore();
  const { expenses } = state;

  return (
    <div className="space-y-6">
      <FormSection
        title="Essential Expenses"
        description="Monthly costs for necessities."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="Housing (Rent / Mortgage)"
            value={expenses.housing}
            onChange={(v) => setExpenses({ housing: v })}
          />
          <NumberInput
            label="Utilities"
            value={expenses.utilities}
            onChange={(v) => setExpenses({ utilities: v })}
            helpText="Electric, water, gas, internet"
          />
          <NumberInput
            label="Transportation"
            value={expenses.transportation}
            onChange={(v) => setExpenses({ transportation: v })}
            helpText="Car payment, gas, insurance, parking"
          />
          <NumberInput
            label="Food / Groceries"
            value={expenses.food}
            onChange={(v) => setExpenses({ food: v })}
          />
          <NumberInput
            label="Childcare"
            value={expenses.childcare}
            onChange={(v) => setExpenses({ childcare: v })}
          />
          <NumberInput
            label="Insurance (non-Tricare)"
            value={expenses.insurance}
            onChange={(v) => setExpenses({ insurance: v })}
            helpText="Auto, renters, life, etc."
          />
        </div>
      </FormSection>

      <FormSection title="Lifestyle Expenses">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="Subscriptions"
            value={expenses.subscriptions}
            onChange={(v) => setExpenses({ subscriptions: v })}
            helpText="Phone, streaming, gym, etc."
          />
          <NumberInput
            label="Discretionary"
            value={expenses.discretionary}
            onChange={(v) => setExpenses({ discretionary: v })}
            helpText="Entertainment, dining out, personal"
          />
        </div>
      </FormSection>

      {/* Computed totals */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Essential</span>
            <p className="font-semibold text-fortress-navy">
              {formatCurrency(expenses.totalEssential)}
            </p>
          </div>
          <div>
            <span className="text-gray-400">Total Monthly</span>
            <p className="font-semibold text-fortress-navy">
              {formatCurrency(expenses.totalMonthly)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
