import type { Action } from '@fortress/types';
import { formatCurrencyWhole } from '../../utils/format-currency';

interface ActionCardProps {
  action: Action;
  onStatusChange: (actionId: string, status: Action['status']) => void;
  muted?: boolean;
}

const difficultyConfig = {
  easy: { badge: 'bg-fortress-green/20 text-fortress-green', label: 'Easy' },
  medium: { badge: 'bg-fortress-yellow/20 text-fortress-yellow', label: 'Medium' },
  hard: { badge: 'bg-fortress-red/20 text-fortress-red', label: 'Hard' },
} as const;

export function ActionCard({ action, onStatusChange, muted = false }: ActionCardProps) {
  const config = difficultyConfig[action.difficulty];
  const isCompleted = action.status === 'completed';
  const isSkipped = action.status === 'skipped';

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4
        ${muted ? 'opacity-60' : ''}
        ${isCompleted ? 'border-l-4 border-l-fortress-green' : ''}
        ${isSkipped ? 'border-l-4 border-l-gray-300' : ''}`}
    >
      {/* Header: title + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4
            className={`text-sm font-semibold ${
              muted ? 'text-gray-400 line-through' : 'text-fortress-navy'
            }`}
          >
            {action.title}
          </h4>
          <p className="text-sm text-gray-600 mt-1">{action.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`${config.badge} text-xs font-bold px-2 py-0.5 rounded-full`}
          >
            {config.label}
          </span>
          <span className="text-xs text-gray-400">~{action.estimatedMinutes} min</span>
        </div>
      </div>

      {/* Mechanism (step-by-step path) */}
      <div className="mt-3 bg-gray-50 rounded px-3 py-2">
        <p className="text-xs text-gray-500 font-medium">How to do it:</p>
        <p className="text-sm text-fortress-slate font-mono">{action.mechanism}</p>
      </div>

      {/* Amount + Deadline + Impact */}
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        {action.amount != null && (
          <div>
            <span className="text-gray-400 text-xs">Amount</span>
            <p className="font-semibold text-fortress-navy">
              {formatCurrencyWhole(action.amount)}
            </p>
          </div>
        )}
        <div>
          <span className="text-gray-400 text-xs">Deadline</span>
          <p className="font-medium text-fortress-slate">{action.deadline}</p>
        </div>
      </div>

      <p className="text-sm text-fortress-green font-medium mt-2">
        {action.estimatedImpact}
      </p>

      {/* Status buttons (active cards only) */}
      {!muted && (
        <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
          <button
            onClick={() => onStatusChange(action.id, 'completed')}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-fortress-green
              text-white hover:bg-fortress-green/90 transition-colors"
          >
            Done
          </button>
          <button
            onClick={() => onStatusChange(action.id, 'skipped')}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300
              text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => onStatusChange(action.id, 'deferred')}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300
              text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Later
          </button>
        </div>
      )}

      {/* Status indicator (muted cards only) */}
      {muted && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`text-xs font-medium ${
              isCompleted ? 'text-fortress-green' : 'text-gray-400'
            }`}
          >
            {isCompleted ? 'Completed' : isSkipped ? 'Skipped' : 'Deferred'}
          </span>
          <button
            onClick={() => onStatusChange(action.id, 'pending')}
            className="text-xs text-gray-400 hover:text-fortress-navy underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
