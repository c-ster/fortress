import { useFinancialStore } from '../../stores/financial-state';
import { formatCurrency, formatPercent } from '../../utils/format-currency';

interface StepReviewProps {
  goTo: (step: number) => void;
}

function SectionHeader({
  title,
  step,
  goTo,
}: {
  title: string;
  step: number;
  goTo: (step: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => goTo(step)}
      className="text-sm font-semibold text-fortress-navy hover:underline text-left"
    >
      {title} →
    </button>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${color || 'text-fortress-slate'}`}>{value}</span>
    </div>
  );
}

export function StepReview({ goTo }: StepReviewProps) {
  const { state } = useFinancialStore();
  const { income, deductions, expenses, debts, assets, risk, meta, military } = state;

  const completenessPercent = Math.round(meta.completeness * 100);
  const completenessColor =
    completenessPercent >= 80
      ? 'text-fortress-green'
      : completenessPercent >= 50
        ? 'text-fortress-yellow'
        : 'text-fortress-red';

  const totalDebtPayments = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const totalDebtBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalDeductions =
    deductions.federalTax + deductions.stateTax + deductions.fica +
    deductions.sgli + deductions.tspTraditional + deductions.tspRoth +
    deductions.tricare + deductions.otherDeductions +
    deductions.allotments.reduce((sum, a) => sum + a.amount, 0);
  const netCashFlow = income.totalGross - expenses.totalMonthly - totalDebtPayments - totalDeductions;

  const dtiPercent = risk.debtToIncomeRatio * 100;
  const dtiColor =
    dtiPercent < 20 ? 'text-fortress-green' : dtiPercent < 36 ? 'text-fortress-yellow' : 'text-fortress-red';

  const emergencyColor =
    risk.emergencyFundMonths >= 3
      ? 'text-fortress-green'
      : risk.emergencyFundMonths >= 1
        ? 'text-fortress-yellow'
        : 'text-fortress-red';

  return (
    <div className="space-y-6">
      {/* Completeness */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-400 mb-1">Data Completeness</p>
        <p className={`text-4xl font-bold ${completenessColor}`}>{completenessPercent}%</p>
        {completenessPercent < 80 && (
          <p className="text-xs text-gray-400 mt-2">
            Fill in more fields to improve your financial readiness assessment.
          </p>
        )}
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Income */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <SectionHeader title="Income" step={1} goTo={goTo} />
          <div className="mt-2">
            <Row label="Gross Monthly" value={formatCurrency(income.totalGross)} />
            <Row label="Taxable" value={formatCurrency(income.totalTaxable)} />
            <Row label="Non-Taxable" value={formatCurrency(income.totalNonTaxable)} />
          </div>
        </div>

        {/* Deductions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <SectionHeader title="Deductions" step={2} goTo={goTo} />
          <div className="mt-2">
            <Row label="Total Deductions" value={formatCurrency(totalDeductions)} />
            <Row
              label="TSP Rate"
              value={formatPercent(deductions.tspContributionPct * 100)}
              color={deductions.tspContributionPct >= 0.05 ? 'text-fortress-green' : 'text-fortress-yellow'}
            />
            <Row label="SGLI Coverage" value={formatCurrency(deductions.sgliCoverage)} />
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <SectionHeader title="Expenses" step={3} goTo={goTo} />
          <div className="mt-2">
            <Row label="Essential" value={formatCurrency(expenses.totalEssential)} />
            <Row label="Total Monthly" value={formatCurrency(expenses.totalMonthly)} />
          </div>
        </div>

        {/* Debts */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <SectionHeader title="Debts" step={4} goTo={goTo} />
          <div className="mt-2">
            <Row label={`${debts.length} debt${debts.length !== 1 ? 's' : ''}`} value={formatCurrency(totalDebtBalance)} />
            <Row label="Monthly Payments" value={formatCurrency(totalDebtPayments)} />
            <Row
              label="High-Interest"
              value={formatCurrency(risk.highInterestDebtTotal)}
              color={risk.highInterestDebtTotal > 0 ? 'text-fortress-red' : undefined}
            />
          </div>
        </div>

        {/* Assets */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <SectionHeader title="Assets" step={5} goTo={goTo} />
          <div className="mt-2">
            <Row label="Liquid" value={formatCurrency(assets.totalLiquid)} />
            <Row label="TSP Balance" value={formatCurrency(assets.tspBalance)} />
            <Row label="Total" value={formatCurrency(assets.totalLiquid + assets.tspBalance + assets.otherInvestments)} />
          </div>
        </div>

        {/* Military */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <SectionHeader title="Military Info" step={0} goTo={goTo} />
          <div className="mt-2">
            <Row label="Pay Grade" value={military.payGrade} />
            <Row label="YOS" value={`${military.yearsOfService} years`} />
            <Row label="Dependents" value={String(military.dependents)} />
            <Row label="Station ZIP" value={military.dutyStation || '—'} />
          </div>
        </div>
      </div>

      {/* Net Cash Flow */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
        <p className="text-sm text-gray-400">Estimated Net Monthly Cash Flow</p>
        <p
          className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-fortress-green' : 'text-fortress-red'}`}
        >
          {formatCurrency(netCashFlow)}
        </p>
      </div>

      {/* Risk Indicators */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-fortress-navy mb-3">Risk Indicators</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-gray-400">Emergency Fund</span>
            <p className={`font-semibold ${emergencyColor}`}>
              {risk.emergencyFundMonths.toFixed(1)} months
            </p>
          </div>
          <div>
            <span className="text-gray-400">Debt-to-Income</span>
            <p className={`font-semibold ${dtiColor}`}>{formatPercent(dtiPercent)}</p>
          </div>
          <div>
            <span className="text-gray-400">TSP Match</span>
            <p
              className={`font-semibold ${
                risk.tspMatchCaptured ? 'text-fortress-green' : 'text-fortress-yellow'
              }`}
            >
              {risk.tspMatchCaptured ? 'Captured' : 'Not Captured'}
            </p>
          </div>
          <div>
            <span className="text-gray-400">SGLI Coverage</span>
            <p
              className={`font-semibold ${
                risk.sgliAdequate ? 'text-fortress-green' : 'text-fortress-red'
              }`}
            >
              {risk.sgliAdequate ? 'Adequate' : 'Inadequate'}
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
    </div>
  );
}
