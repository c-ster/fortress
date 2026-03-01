import { useState } from 'react';
import type { OwnerGrant } from '../../hooks/useHomefront';

interface GrantStatusProps {
  grant: OwnerGrant;
  onRevoke: () => Promise<boolean>;
  isLoading: boolean;
}

export function GrantStatus({ grant, onRevoke, isLoading }: GrantStatusProps) {
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const handleRevoke = async () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    await onRevoke();
    setConfirmRevoke(false);
  };

  const statusBadge = grant.accepted ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-fortress-green/10 text-fortress-green">
      Accepted
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-fortress-yellow/10 text-fortress-yellow">
      Pending
    </span>
  );

  const permissionBadge = grant.permission === 'write' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      View & Edit
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      View Only
    </span>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-fortress-slate mb-4">
        Active Homefront Link
      </h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Spouse Email</span>
          <span className="text-sm font-medium text-fortress-navy">{grant.spouseEmail}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Permission</span>
          {permissionBadge}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Status</span>
          {statusBadge}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Expires</span>
          <span className="text-sm text-gray-700">
            {new Date(grant.expiresAt).toLocaleDateString()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Created</span>
          <span className="text-sm text-gray-700">
            {new Date(grant.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-200">
        {confirmRevoke ? (
          <div className="space-y-2">
            <p className="text-sm text-fortress-red font-medium">
              Are you sure? This will immediately revoke your spouse&apos;s access.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRevoke}
                disabled={isLoading}
                className="flex-1 bg-fortress-red text-white py-1.5 rounded-md text-sm font-medium
                  hover:bg-fortress-red/90 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Revoking...' : 'Confirm Revoke'}
              </button>
              <button
                onClick={() => setConfirmRevoke(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-1.5 rounded-md text-sm
                  font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleRevoke}
            className="w-full border border-fortress-red text-fortress-red py-1.5 rounded-md
              text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Revoke Access
          </button>
        )}
      </div>
    </div>
  );
}
