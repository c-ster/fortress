/**
 * New child action checklist.
 * Grouped by timeframe: Before Birth, Within 30 Days, Within 90 Days.
 * Items color-coded by category.
 */

import { useState } from 'react';
import type { NewChildAction, NewChildTimeframe, NewChildActionCategory } from '@fortress/types';

interface NewChildActionListProps {
  actions: NewChildAction[];
}

const TIMEFRAME_CONFIG: Record<NewChildTimeframe, { label: string; color: string; bg: string; dot: string }> = {
  before_birth: { label: 'Before Birth', color: 'text-fortress-navy', bg: 'bg-fortress-navy/5', dot: 'bg-fortress-navy' },
  within_30_days: { label: 'Within 30 Days', color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  within_90_days: { label: 'Within 90 Days', color: 'text-fortress-yellow', bg: 'bg-yellow-50', dot: 'bg-fortress-yellow' },
};

const CATEGORY_BADGE: Record<NewChildActionCategory, { label: string; style: string }> = {
  admin: { label: 'Admin', style: 'bg-gray-100 text-gray-600' },
  financial: { label: 'Financial', style: 'bg-green-100 text-green-700' },
  insurance: { label: 'Insurance', style: 'bg-blue-100 text-blue-700' },
  legal: { label: 'Legal', style: 'bg-purple-100 text-purple-700' },
};

const TIMEFRAME_ORDER: NewChildTimeframe[] = ['before_birth', 'within_30_days', 'within_90_days'];

export function NewChildActionList({ actions }: NewChildActionListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['before_birth']));

  const toggle = (tf: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tf)) next.delete(tf);
      else next.add(tf);
      return next;
    });
  };

  if (actions.length === 0) return null;

  // Group actions by timeframe
  const groups = TIMEFRAME_ORDER.map((tf) => ({
    timeframe: tf,
    items: actions.filter((a) => a.timeframe === tf),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-fortress-navy mb-4 uppercase tracking-wider">
        Action Checklist
      </h3>

      <div className="space-y-3">
        {groups.map(({ timeframe, items }) => {
          const config = TIMEFRAME_CONFIG[timeframe];
          const isOpen = expanded.has(timeframe);

          return (
            <div key={timeframe}>
              {/* Timeframe header */}
              <button
                onClick={() => toggle(timeframe)}
                className="w-full flex items-center gap-2 py-2 text-left"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                <h4 className={`text-sm font-semibold ${config.color} flex-1`}>
                  {config.label}
                </h4>
                <span className="text-xs text-gray-400">
                  {items.length} items
                </span>
                <span className="text-gray-400 text-xs">
                  {isOpen ? '\u25BE' : '\u25B8'}
                </span>
              </button>

              {/* Items */}
              {isOpen && (
                <div className="space-y-2 ml-5 mt-1">
                  {items.map((action) => {
                    const badge = CATEGORY_BADGE[action.category];
                    return (
                      <div key={action.id} className={`p-3 rounded-md ${config.bg}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-gray-300 mt-0.5">{'\u2610'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-fortress-slate">
                                {action.title}
                              </p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.style}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{action.description}</p>
                            <p className="text-xs text-gray-400 mt-1 italic">{action.mechanism}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
