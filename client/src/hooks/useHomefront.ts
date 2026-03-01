import { useState, useEffect, useCallback } from 'react';
import { config } from '../config';
import { useAuthStore } from '../stores/auth';
import type { EncryptedPayload } from '@fortress/types';

// --- Types ---

export interface OwnerGrant {
  spouseEmail: string;
  permission: 'read' | 'write';
  accepted: boolean;
  active: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface SpouseGrant {
  ownerEmail: string;
  permission: 'read' | 'write';
  active: boolean;
}

export interface HomefrontStatus {
  role: 'owner' | 'spouse' | null;
  grant: OwnerGrant | SpouseGrant | null;
}

export interface InviteResult {
  inviteToken: string;
  expiresAt: string;
}

// --- Hook ---

export function useHomefront() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const [status, setStatus] = useState<HomefrontStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  // Fetch status on mount
  useEffect(() => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(`${config.apiUrl}/homefront/status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        });

        if (!res.ok) throw new Error('Failed to load Homefront status');
        const data = await res.json();
        if (!cancelled) setStatus(data as HomefrontStatus);
      } catch {
        if (!cancelled) setError('Could not load Homefront status');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchStatus();
    return () => { cancelled = true; };
  }, [accessToken]);

  const sendInvite = useCallback(
    async (spouseEmail: string, permission: 'read' | 'write'): Promise<boolean> => {
      setError(null);
      setIsLoading(true);
      try {
        const res = await fetch(`${config.apiUrl}/homefront/invite`, {
          method: 'POST',
          headers: headers(),
          credentials: 'include',
          body: JSON.stringify({ spouseEmail, permission }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ message: 'Invite failed' }));
          setError(body.message || 'Invite failed');
          return false;
        }

        const data = await res.json();
        setInviteResult(data as InviteResult);

        // Refresh status to show the new grant
        setStatus({
          role: 'owner',
          grant: {
            spouseEmail,
            permission,
            accepted: false,
            active: true,
            expiresAt: data.expiresAt,
            createdAt: new Date().toISOString(),
          },
        });
        return true;
      } catch {
        setError('Network error — please try again');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [headers],
  );

  const revokeGrant = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/homefront/grant`, {
        method: 'DELETE',
        headers: headers(),
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Revoke failed' }));
        setError(body.message || 'Revoke failed');
        return false;
      }

      setStatus({ role: null, grant: null });
      setInviteResult(null);
      return true;
    } catch {
      setError('Network error — please try again');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [headers]);

  const loadSpouseSnapshot = useCallback(async (): Promise<EncryptedPayload | null> => {
    setError(null);
    try {
      const res = await fetch(`${config.apiUrl}/homefront/snapshot`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      });

      if (res.status === 404) return null;
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to load snapshot' }));
        setError(body.message || 'Failed to load snapshot');
        return null;
      }

      return (await res.json()) as EncryptedPayload;
    } catch {
      setError('Network error — please try again');
      return null;
    }
  }, [accessToken]);

  const saveSpouseSnapshot = useCallback(
    async (payload: EncryptedPayload): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch(`${config.apiUrl}/homefront/snapshot`, {
          method: 'POST',
          headers: headers(),
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ message: 'Save failed' }));
          setError(body.message || 'Save failed');
          return false;
        }

        return true;
      } catch {
        setError('Network error — please try again');
        return false;
      }
    },
    [headers],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    status,
    isLoading,
    error,
    inviteResult,
    sendInvite,
    revokeGrant,
    loadSpouseSnapshot,
    saveSpouseSnapshot,
    clearError,
  };
}
