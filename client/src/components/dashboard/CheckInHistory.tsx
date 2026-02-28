/**
 * Collapsible history of past check-ins.
 * Shows last 5 completed check-ins with date and response count.
 */

import { useState } from 'react';
import type { CheckIn } from '@fortress/types';
import { getCheckInHistory } from '../../engine/check-in-scheduler';

interface CheckInHistoryProps {
  checkIns: CheckIn[];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CheckInHistory({ checkIns }: CheckInHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const history = getCheckInHistory(checkIns, 5);

  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <h4 className="text-sm font-semibold text-fortress-navy">
          Past Check-Ins{' '}
          <span className="text-gray-400 font-normal">({history.length})</span>
        </h4>
        <span className="text-gray-400 text-sm">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-0 divide-y divide-gray-100">
          {history.map((ci) => (
            <div key={ci.id} className="py-2 flex items-center justify-between">
              <div>
                <span className="text-sm text-fortress-slate">
                  {formatDate(ci.scheduledDate)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {ci.responses.length} response{ci.responses.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-medium text-fortress-green">
                  Completed
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
