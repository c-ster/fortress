/**
 * Action plan tier section (This Week / Next 30 Days / 90-Day Goals).
 * Shows active actions followed by completed/skipped actions.
 */

import { ActionCard } from './ActionCard';
import type { Action } from '@fortress/types';

interface ActionTierProps {
  title: string;
  subtitle: string;
  actions: Action[];
  onStatusChange: (actionId: string, status: Action['status']) => void;
}

export function ActionTier({ title, subtitle, actions, onStatusChange }: ActionTierProps) {
  const active = actions.filter(
    (a) => a.status === 'pending' || a.status === 'deferred',
  );
  const completed = actions.filter(
    (a) => a.status === 'completed' || a.status === 'skipped',
  );

  return (
    <div className="mb-6">
      <h4 className="text-base font-semibold text-fortress-navy mb-0.5">
        {title}{' '}
        <span className="text-sm font-normal text-gray-400">
          ({active.length} remaining)
        </span>
      </h4>
      <p className="text-sm text-gray-500 mb-3">{subtitle}</p>

      <div className="space-y-3">
        {active.map((action) => (
          <ActionCard
            key={action.id}
            action={action}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>

      {completed.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
            Completed / Skipped ({completed.length})
          </p>
          <div className="space-y-2">
            {completed.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onStatusChange={onStatusChange}
                muted
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
