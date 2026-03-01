/**
 * Read-only Black Box content viewer.
 * Groups entries by category and displays them in styled cards.
 * Used by both the owner (preview) and emergency contact (access page).
 */

import type { BlackBoxContent, BlackBoxCategory } from '@fortress/types';

interface BlackBoxViewerProps {
  content: BlackBoxContent;
}

const CATEGORY_CONFIG: Record<BlackBoxCategory, { label: string; style: string }> = {
  account: { label: 'Accounts', style: 'bg-green-100 text-green-700' },
  insurance: { label: 'Insurance', style: 'bg-blue-100 text-blue-700' },
  bill: { label: 'Bills & Payments', style: 'bg-yellow-100 text-yellow-700' },
  contact: { label: 'Emergency Contacts', style: 'bg-purple-100 text-purple-700' },
  document: { label: 'Documents', style: 'bg-gray-100 text-gray-700' },
};

const CATEGORY_ORDER: BlackBoxCategory[] = [
  'account',
  'insurance',
  'bill',
  'contact',
  'document',
];

export function BlackBoxViewer({ content }: BlackBoxViewerProps) {
  const groups = CATEGORY_ORDER
    .map((cat) => ({
      category: cat,
      entries: content.entries.filter((e) => e.category === cat),
    }))
    .filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      {content.ownerName && (
        <div className="text-center border-b border-gray-200 pb-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider">
            Emergency Financial Sheet
          </p>
          <p className="text-lg font-bold text-fortress-navy mt-1">
            {content.ownerName}
          </p>
        </div>
      )}

      {/* Entry groups */}
      {groups.map(({ category, entries }) => {
        const config = CATEGORY_CONFIG[category];
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${config.style}`}>
                {config.label}
              </span>
              <span className="text-xs text-gray-400">
                {entries.length} {entries.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white border border-gray-200 rounded-lg p-3"
                >
                  <p className="text-sm font-semibold text-fortress-slate">
                    {entry.label}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">{entry.details}</p>
                  {entry.notes && (
                    <p className="text-xs text-gray-400 mt-1 italic">{entry.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div className="text-center pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-400">
          Last updated: {new Date(content.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          This document contains financial logistics only &mdash; no balances or credentials.
        </p>
      </div>
    </div>
  );
}
