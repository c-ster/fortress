import { useFinancialStore } from '../../stores/financial-state';
import { FormSection } from '../shared/FormSection';
import { NumberInput } from '../shared/NumberInput';
import { SelectInput } from '../shared/SelectInput';
import { TextInput } from '../shared/TextInput';
import { CheckboxInput } from '../shared/CheckboxInput';
import { formatCurrency } from '../../utils/format-currency';
import type { Debt } from '@fortress/types';

const DEBT_TYPE_OPTIONS = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'auto', label: 'Auto Loan' },
  { value: 'personal', label: 'Personal Loan' },
  { value: 'student', label: 'Student Loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'other', label: 'Other' },
];

export function StepDebts() {
  const { state, addDebt, removeDebt, updateDebt } = useFinancialStore();
  const { debts, risk } = state;

  const handleAdd = () => {
    const debt: Debt = {
      id: crypto.randomUUID(),
      name: '',
      type: 'credit_card',
      balance: 0,
      apr: 0,
      minimumPayment: 0,
      monthlyPayment: 0,
      preService: false,
    };
    addDebt(debt);
  };

  const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalPayments = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);

  return (
    <div className="space-y-6">
      <FormSection
        title="Outstanding Debts"
        description="List all loans, credit cards, and other debts. This helps assess your financial readiness and SCRA eligibility."
      >
        {debts.length === 0 && (
          <p className="text-sm text-gray-400 mb-4">
            No debts added. If you have any loans, credit cards, or other debts, add them here.
          </p>
        )}

        <div className="space-y-4">
          {debts.map((debt, index) => (
            <div
              key={debt.id}
              className="border border-gray-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-fortress-navy">
                  Debt {index + 1}{debt.name ? `: ${debt.name}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => removeDebt(debt.id)}
                  className="text-fortress-red hover:text-fortress-red/80 text-sm font-medium"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput
                  label="Name"
                  value={debt.name}
                  onChange={(v) => updateDebt(debt.id, { name: v })}
                  placeholder="e.g., Chase Visa"
                />
                <SelectInput
                  label="Type"
                  value={debt.type}
                  onChange={(v) =>
                    updateDebt(debt.id, {
                      type: v as Debt['type'],
                    })
                  }
                  options={DEBT_TYPE_OPTIONS}
                />
                <NumberInput
                  label="Balance"
                  value={debt.balance}
                  onChange={(v) => updateDebt(debt.id, { balance: v })}
                />
                <NumberInput
                  label="APR"
                  value={debt.apr}
                  onChange={(v) => updateDebt(debt.id, { apr: v })}
                  prefix=""
                  suffix="%"
                  step={0.01}
                />
                <NumberInput
                  label="Minimum Payment"
                  value={debt.minimumPayment}
                  onChange={(v) => updateDebt(debt.id, { minimumPayment: v })}
                />
                <NumberInput
                  label="Monthly Payment"
                  value={debt.monthlyPayment}
                  onChange={(v) => updateDebt(debt.id, { monthlyPayment: v })}
                  helpText="What you actually pay each month"
                />
              </div>

              <CheckboxInput
                label="This debt existed before entering service"
                checked={debt.preService}
                onChange={(v) => updateDebt(debt.id, { preService: v })}
                helpText="Pre-service debts may qualify for SCRA rate reduction to 6%"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="mt-4 text-sm font-medium text-fortress-navy hover:text-fortress-navy/80"
        >
          + Add Debt
        </button>
      </FormSection>

      {/* Summary */}
      {debts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Total Balance</span>
              <p className="font-semibold">{formatCurrency(totalBalance)}</p>
            </div>
            <div>
              <span className="text-gray-400">Total Payments</span>
              <p className="font-semibold">{formatCurrency(totalPayments)}</p>
            </div>
            <div>
              <span className="text-gray-400">High-Interest (&gt;15%)</span>
              <p
                className={`font-semibold ${
                  risk.highInterestDebtTotal > 0 ? 'text-fortress-red' : 'text-fortress-green'
                }`}
              >
                {formatCurrency(risk.highInterestDebtTotal)}
              </p>
            </div>
            {risk.scraOpportunity > 0 && (
              <div>
                <span className="text-gray-400">SCRA Savings</span>
                <p className="font-semibold text-fortress-green">
                  {formatCurrency(risk.scraOpportunity)}/mo
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
