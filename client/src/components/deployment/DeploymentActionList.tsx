/**
 * Deployment preparation action list.
 * Groups actions by tier (Immediate / Stabilization) with details.
 */

import type { DeploymentAction } from '@fortress/types';

interface DeploymentActionListProps {
  actions: DeploymentAction[];
}

const TIER_CONFIG = {
  immediate: {
    label: 'Immediate',
    sublabel: 'Complete before departure',
    color: 'text-fortress-red',
    bg: 'bg-red-50',
    dot: 'bg-fortress-red',
  },
  stabilization: {
    label: 'Stabilization',
    sublabel: 'Complete within 30 days',
    color: 'text-fortress-yellow',
    bg: 'bg-yellow-50',
    dot: 'bg-fortress-yellow',
  },
};

export function DeploymentActionList({ actions }: DeploymentActionListProps) {
  const immediate = actions.filter((a) => a.tier === 'immediate');
  const stabilization = actions.filter((a) => a.tier === 'stabilization');

  const tiers = [
    { key: 'immediate' as const, actions: immediate },
    { key: 'stabilization' as const, actions: stabilization },
  ].filter((t) => t.actions.length > 0);

  if (tiers.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-fortress-navy mb-4 uppercase tracking-wider">
        Preparation Checklist
      </h3>

      <div className="space-y-5">
        {tiers.map(({ key, actions: tierActions }) => {
          const config = TIER_CONFIG[key];
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                <h4 className={`text-sm font-semibold ${config.color}`}>
                  {config.label}
                </h4>
                <span className="text-xs text-gray-400">{config.sublabel}</span>
              </div>

              <div className="space-y-2 ml-5">
                {tierActions.map((action) => (
                  <div
                    key={action.id}
                    className={`p-3 rounded-md ${config.bg}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-gray-300 mt-0.5">&#9744;</span>
                        <div>
                          <p className="text-sm font-medium text-fortress-slate">
                            {action.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {action.description}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 italic">
                            {action.mechanism}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        ~{action.estimatedMinutes}min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
