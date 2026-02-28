/**
 * Call-to-action card linking to the Financial Path Simulator.
 * Improves discoverability of the simulator from the dashboard.
 */

import { Link } from 'react-router-dom';

export function SimulatorCta() {
  return (
    <div className="bg-fortress-navy/5 border border-fortress-navy/15 rounded-lg p-5
      flex items-center justify-between gap-4">
      <div>
        <h4 className="text-sm font-semibold text-fortress-navy">
          Explore Financial Projections
        </h4>
        <p className="text-sm text-gray-600 mt-1">
          Run Monte Carlo simulations to see how different strategies affect your 40-year outlook.
        </p>
      </div>
      <Link
        to="/simulator"
        className="shrink-0 bg-fortress-navy text-white px-4 py-2 rounded-md
          text-sm font-medium hover:bg-fortress-navy/90 transition-colors"
      >
        Open Simulator &rarr;
      </Link>
    </div>
  );
}
