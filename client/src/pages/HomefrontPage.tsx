import { useHomefront, type OwnerGrant, type SpouseGrant } from '../hooks/useHomefront';
import { InviteForm } from '../components/homefront/InviteForm';
import { GrantStatus } from '../components/homefront/GrantStatus';
import { SpouseView } from '../components/homefront/SpouseView';

export function HomefrontPage() {
  const {
    status,
    isLoading,
    error,
    inviteResult,
    sendInvite,
    revokeGrant,
    loadSpouseSnapshot,
    saveSpouseSnapshot,
    clearError,
  } = useHomefront();

  return (
    <div>
      <h2 className="text-2xl font-bold text-fortress-navy mb-1">Homefront Link</h2>
      <p className="text-gray-500 text-sm mb-6">
        Share secure access to your financial snapshot with your spouse or partner.
      </p>

      {/* Loading */}
      {isLoading && !status && (
        <div className="flex items-center justify-center py-16">
          <div className="text-gray-400 text-sm">Loading Homefront status...</div>
        </div>
      )}

      {/* No active link */}
      {!isLoading && status?.role === null && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <InviteForm
              onInvite={async (email, perm) => {
                clearError();
                return sendInvite(email, perm);
              }}
              inviteResult={inviteResult}
              isLoading={isLoading}
              error={error}
            />
          </div>
          <div className="lg:col-span-2">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
              <div className="text-3xl mb-3">&#128279;</div>
              <h3 className="text-lg font-semibold text-fortress-navy mb-2">
                No Active Homefront Link
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                Create an invite to share your encrypted financial snapshot with your
                spouse. They&apos;ll need your data passphrase to view it.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Owner view */}
      {!isLoading && status?.role === 'owner' && status.grant && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <InviteForm
              onInvite={async (email, perm) => {
                clearError();
                return sendInvite(email, perm);
              }}
              inviteResult={inviteResult}
              isLoading={isLoading}
              error={error}
            />
          </div>
          <div className="lg:col-span-2">
            <GrantStatus
              grant={status.grant as OwnerGrant}
              onRevoke={revokeGrant}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {/* Spouse view */}
      {!isLoading && status?.role === 'spouse' && status.grant && (
        <SpouseView
          grant={status.grant as SpouseGrant}
          onLoadSnapshot={loadSpouseSnapshot}
          onSaveSnapshot={saveSpouseSnapshot}
        />
      )}
    </div>
  );
}
