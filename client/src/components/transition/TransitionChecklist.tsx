/**
 * Transition preparation checklist.
 * Time-phased accordion: 12 months, 6 months, 90 days, 30 days.
 * Items color-coded by category.
 */

import { useState } from 'react';
import type { TransitionChecklist as ChecklistType, ChecklistCategory } from '@fortress/types';

interface TransitionChecklistProps {
  checklists: ChecklistType[];
}

const PHASE_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  '12_months': { color: 'text-fortress-navy', bg: 'bg-fortress-navy/5', dot: 'bg-fortress-navy' },
  '6_months': { color: 'text-fortress-yellow', bg: 'bg-yellow-50', dot: 'bg-fortress-yellow' },
  '90_days': { color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  '30_days': { color: 'text-fortress-red', bg: 'bg-red-50', dot: 'bg-fortress-red' },
};

const CATEGORY_BADGE: Record<ChecklistCategory, { label: string; style: string }> = {
  financial: { label: 'Financial', style: 'bg-green-100 text-green-700' },
  benefits: { label: 'Benefits', style: 'bg-blue-100 text-blue-700' },
  career: { label: 'Career', style: 'bg-purple-100 text-purple-700' },
  legal: { label: 'Legal', style: 'bg-gray-100 text-gray-600' },
};

export function TransitionChecklist({ checklists }: TransitionChecklistProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand the first (most urgent applicable) phase
    const first = checklists[0]?.phase;
    return first ? new Set([first]) : new Set();
  });

  const toggle = (phase: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  if (checklists.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-fortress-navy mb-4 uppercase tracking-wider">
        Transition Checklist
      </h3>

      <div className="space-y-3">
        {checklists.map((checklist) => {
          const config = PHASE_CONFIG[checklist.phase] ?? PHASE_CONFIG['30_days'];
          const isOpen = expanded.has(checklist.phase);

          return (
            <div key={checklist.phase}>
              {/* Phase header — clickable */}
              <button
                onClick={() => toggle(checklist.phase)}
                className="w-full flex items-center gap-2 py-2 text-left"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                <h4 className={`text-sm font-semibold ${config.color} flex-1`}>
                  {checklist.label}
                </h4>
                <span className="text-xs text-gray-400">
                  {checklist.items.length} items
                </span>
                <span className="text-gray-400 text-xs">
                  {isOpen ? '▾' : '▸'}
                </span>
              </button>

              {/* Items */}
              {isOpen && (
                <div className="space-y-2 ml-5 mt-1">
                  {checklist.items.map((item) => {
                    const badge = CATEGORY_BADGE[item.category];
                    return (
                      <div key={item.id} className={`p-3 rounded-md ${config.bg}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-gray-300 mt-0.5">☐</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-fortress-slate">
                                {item.title}
                              </p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.style}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                            <p className="text-xs text-gray-400 mt-1 italic">{item.mechanism}</p>
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
