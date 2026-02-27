import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFinancialStore } from '../stores/financial-state';
import { calculateRiskScore } from '../engine/risk-engine';
import { RiskScore } from '../components/dashboard/RiskScore';
import { FindingCard } from '../components/dashboard/FindingCard';

function DataQualityBanner({ completeness }: { completeness: number }) {
  return (
    <div className="bg-yellow-50 border border-fortress-yellow/30 rounded-lg p-4 mb-6
      flex items-start gap-3">
      <span className="text-fortress-yellow text-lg">&#9888;</span>
      <div>
        <p className="text-sm font-semibold text-fortress-slate">
          Preliminary Score ({Math.round(completeness * 100)}% data)
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Your risk score may not be fully accurate. Complete your financial intake for a
          comprehensive assessment.
        </p>
        <Link
          to="/intake"
          className="text-sm text-fortress-navy font-medium hover:underline mt-2
            inline-block"
        >
          Complete Intake &rarr;
        </Link>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { state } = useFinancialStore();
  const assessment = useMemo(() => calculateRiskScore(state), [state]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-fortress-navy mb-2">
        Financial Readiness Dashboard
      </h2>
      <p className="text-gray-600 mb-6">
        Your personalized risk score based on current financial data.
      </p>

      {assessment.dataQuality < 0.5 && (
        <DataQualityBanner completeness={assessment.dataQuality} />
      )}

      <RiskScore score={assessment.overallScore} tier={assessment.tier} />

      <section className="mt-8">
        <h3 className="text-lg font-semibold text-fortress-navy mb-4">
          Findings{' '}
          <span className="text-sm font-normal text-gray-400">
            ({assessment.findings.length})
          </span>
        </h3>

        {assessment.findings.length === 0 ? (
          <div className="bg-green-50 border border-fortress-green/30 rounded-lg p-6
            text-center">
            <span className="text-fortress-green text-2xl font-bold">&#10003;</span>
            <p className="text-sm text-green-800 mt-2">
              No risk findings — great financial readiness posture!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assessment.findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 flex gap-3">
        <Link
          to="/intake"
          className="border border-fortress-navy text-fortress-navy px-6 py-2.5
            rounded-md text-sm font-medium hover:bg-fortress-navy/10 transition-colors"
        >
          Update Financial Data
        </Link>
      </div>
    </div>
  );
}
