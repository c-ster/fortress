import { create } from 'zustand';
import { config } from '../config';
import { clearPassphrase } from '../crypto/passphrase-cache';

interface UserInfo {
  id: string;
  email: string;
  milVerified: boolean;
  mfaEnabled: boolean;
}

type LoginResult = 'success' | 'mfa_required' | 'error';

interface AuthState {
  accessToken: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  requiresMfa: boolean;

  login: (email: string, password: string) => Promise<LoginResult>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;

  // MFA login challenge
  verifyMfa: (token: string) => Promise<boolean>;

  // .mil verification (two-phase)
  verifyMilEmail: (milEmail: string) => Promise<boolean>;
  verifyMilCode: (code: string) => Promise<{ success: boolean; milEmail?: string }>;

  // MFA setup (settings)
  setupMfa: () => Promise<{ secret: string; uri: string } | null>;
  confirmMfa: (token: string) => Promise<boolean>;
}

/** Decode JWT payload (middle segment) without a library. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Extract user info from a JWT access token. */
function userFromToken(token: string, fallbackEmail?: string): UserInfo | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    id: (payload.userId as string) ?? '',
    email: (payload.email as string) ?? fallbackEmail ?? '',
    milVerified: (payload.milVerified as boolean) ?? false,
    mfaEnabled: (payload.mfaEnabled as boolean) ?? false,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  requiresMfa: false,

  login: async (email: string, password: string): Promise<LoginResult> => {
    set({ isLoading: true, error: null, requiresMfa: false });
    try {
      const res = await fetch(`${config.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Login failed' }));
        set({ isLoading: false, error: body.message || 'Login failed' });
        return 'error';
      }

      const data = await res.json();

      if (data.requiresMfa) {
        // MFA required — store temp token, user is not fully authenticated
        set({
          accessToken: data.accessToken,
          isAuthenticated: false,
          isLoading: false,
          requiresMfa: true,
          error: null,
        });
        return 'mfa_required';
      }

      const user = userFromToken(data.accessToken, email) ??
        data.user ?? { id: '', email, milVerified: false, mfaEnabled: false };

      set({
        accessToken: data.accessToken,
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        requiresMfa: false,
      });
      return 'success';
    } catch {
      set({ isLoading: false, error: 'Network error — please try again' });
      return 'error';
    }
  },

  register: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${config.apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Registration failed' }));
        set({ isLoading: false, error: body.message || 'Registration failed' });
        return false;
      }

      const data = await res.json();
      const user = userFromToken(data.accessToken, email) ??
        data.user ?? { id: '', email, milVerified: false, mfaEnabled: false };

      set({
        accessToken: data.accessToken,
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    } catch {
      set({ isLoading: false, error: 'Network error — please try again' });
      return false;
    }
  },

  logout: () => {
    clearPassphrase();
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      requiresMfa: false,
    });
  },

  refreshSession: async (): Promise<boolean> => {
    // Don't show loading if we're already authenticated
    if (!get().isAuthenticated) {
      set({ isLoading: true });
    }
    try {
      const res = await fetch(`${config.apiUrl}/auth/session`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        set({ isLoading: false });
        return false;
      }

      const data = await res.json();
      const user = userFromToken(data.accessToken) ?? get().user ?? null;

      set({
        accessToken: data.accessToken,
        user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  // --- MFA login challenge ---
  verifyMfa: async (token: string): Promise<boolean> => {
    const { accessToken } = get();
    if (!accessToken) return false;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${config.apiUrl}/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Invalid code' }));
        set({ isLoading: false, error: body.message || 'Invalid code' });
        return false;
      }

      const data = await res.json();
      const user = userFromToken(data.accessToken) ?? get().user ?? null;

      set({
        accessToken: data.accessToken,
        user,
        isAuthenticated: true,
        isLoading: false,
        requiresMfa: false,
        error: null,
      });
      return true;
    } catch {
      set({ isLoading: false, error: 'Network error — please try again' });
      return false;
    }
  },

  // --- .mil verification ---
  verifyMilEmail: async (milEmail: string): Promise<boolean> => {
    const { accessToken } = get();
    if (!accessToken) return false;

    try {
      const res = await fetch(`${config.apiUrl}/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ email: milEmail }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to send verification' }));
        throw new Error(body.message || 'Failed to send verification');
      }
      return true;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Network error');
    }
  },

  verifyMilCode: async (
    code: string,
  ): Promise<{ success: boolean; milEmail?: string }> => {
    const { accessToken } = get();
    if (!accessToken) return { success: false };

    try {
      const res = await fetch(`${config.apiUrl}/auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Invalid code' }));
        throw new Error(body.message || 'Invalid code');
      }

      const data = await res.json();

      // Update user info to reflect verified status
      set((state) => ({
        user: state.user ? { ...state.user, milVerified: true } : state.user,
      }));

      return { success: true, milEmail: data.milEmail };
    } catch (err) {
      throw err instanceof Error ? err : new Error('Network error');
    }
  },

  // --- MFA setup (from settings) ---
  setupMfa: async (): Promise<{ secret: string; uri: string } | null> => {
    const { accessToken } = get();
    if (!accessToken) return null;

    try {
      const res = await fetch(`${config.apiUrl}/auth/mfa/setup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (!res.ok) return null;

      const data = await res.json();
      return { secret: data.secret, uri: data.uri };
    } catch {
      return null;
    }
  },

  confirmMfa: async (token: string): Promise<boolean> => {
    const { accessToken } = get();
    if (!accessToken) return false;

    try {
      const res = await fetch(`${config.apiUrl}/auth/mfa/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      if (!res.ok) return false;

      // Update user info to reflect MFA enabled
      set((state) => ({
        user: state.user ? { ...state.user, mfaEnabled: true } : state.user,
      }));
      return true;
    } catch {
      return false;
    }
  },
}));
