/**
 * Yellow warning banner when financial data completeness is below 50%.
 * Links to intake page for users to complete their profile.
 */

import { Link } from 'react-router-dom';

interface DataQualityBannerProps {
  completeness: number;
}

export function DataQualityBanner({ completeness }: DataQualityBannerProps) {
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
