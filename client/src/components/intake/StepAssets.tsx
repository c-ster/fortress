import { useFinancialStore } from '../../stores/financial-state';
import { FormSection } from '../shared/FormSection';
import { NumberInput } from '../shared/NumberInput';
import { formatCurrency } from '../../utils/format-currency';

export function StepAssets() {
  const { state, setAssets } = useFinancialStore();
  const { assets, risk } = state;

  const emergencyColor =
    risk.emergencyFundMonths >= 3
      ? 'text-fortress-green'
      : risk.emergencyFundMonths >= 1
        ? 'text-fortress-yellow'
        : 'text-fortress-red';

  return (
    <div className="space-y-6">
      <FormSection title="Cash Accounts" description="Your liquid savings and checking balances.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="Checking Balance"
            value={assets.checkingBalance}
            onChange={(v) => setAssets({ checkingBalance: v })}
          />
          <NumberInput
            label="Savings Balance"
            value={assets.savingsBalance}
            onChange={(v) => setAssets({ savingsBalance: v })}
          />
          <NumberInput
            label="Emergency Fund"
            value={assets.emergencyFund}
            onChange={(v) => setAssets({ emergencyFund: v })}
            helpText="Dedicated emergency savings, if separate from above"
          />
        </div>
      </FormSection>

      <FormSection title="Investments">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="TSP Balance"
            value={assets.tspBalance}
            onChange={(v) => setAssets({ tspBalance: v })}
            helpText="Current TSP account balance"
          />
          <NumberInput
            label="Other Investments"
            value={assets.otherInvestments}
            onChange={(v) => setAssets({ otherInvestments: v })}
            helpText="IRAs, brokerage accounts, crypto, etc."
          />
        </div>
      </FormSection>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Liquid Assets</span>
            <p className="font-semibold text-fortress-navy">
              {formatCurrency(assets.totalLiquid)}
            </p>
          </div>
          <div>
            <span className="text-gray-400">Emergency Fund Coverage</span>
            <p className={`font-semibold ${emergencyColor}`}>
              {risk.emergencyFundMonths.toFixed(1)} months
            </p>
            {risk.emergencyFundMonths < 3 && (
              <p className="text-xs text-gray-400">Goal: 3-6 months of essential expenses</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
