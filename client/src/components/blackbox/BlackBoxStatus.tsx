/**
 * Black Box status display for the owner.
 * Shows contact info, expiry, timestamps, and edit/delete actions.
 */

import { useState } from 'react';
import type { BlackBoxStatus as BlackBoxStatusType } from '@fortress/types';

interface BlackBoxStatusProps {
  status: BlackBoxStatusType;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-500">{label}</span>
      <span className="text-fortress-slate font-medium">{value}</span>
    </div>
  );
}

export function BlackBoxStatusCard({
  status,
  onEdit,
  onDelete,
  isDeleting,
}: BlackBoxStatusProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formatDate = (iso: string | null) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = status.expiresAt
    ? new Date(status.expiresAt) < new Date()
    : false;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">&#128274;</span>
        <h3 className="text-sm font-semibold text-fortress-navy uppercase tracking-wider">
          Black Box Active
        </h3>
        {isExpired && (
          <span className="text-xs bg-fortress-red/10 text-fortress-red px-2 py-0.5 rounded font-medium">
            Expired
          </span>
        )}
      </div>

      <div className="space-y-1 mb-4">
        <Row label="Emergency Contact" value={status.contactName ?? 'Not set'} />
        <Row label="Contact Email" value={status.contactEmail ?? 'Not set'} />
        <Row
          label="Expires"
          value={status.expiresAt ? formatDate(status.expiresAt) : 'No expiry'}
        />
        <Row label="Created" value={formatDate(status.createdAt)} />
        <Row label="Last Updated" value={formatDate(status.updatedAt)} />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 bg-fortress-navy text-white py-2 rounded-md text-sm font-medium
            hover:bg-fortress-navy/90 transition-colors"
        >
          Edit Black Box
        </button>

        {confirmDelete ? (
          <div className="flex-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              disabled={isDeleting}
              className="flex-1 bg-fortress-red text-white py-2 rounded-md text-sm font-medium
                hover:bg-fortress-red/90 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-md text-sm
                font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex-1 border border-fortress-red/30 text-fortress-red py-2 rounded-md
              text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
