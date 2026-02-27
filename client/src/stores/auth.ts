import { create } from 'zustand';
import { config } from '../config';

interface UserInfo {
  id: string;
  email: string;
}

interface AuthState {
  accessToken: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
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
        return false;
      }

      const data = await res.json();

      if (data.requiresMfa) {
        // MFA required — store temp token, user is not fully authenticated
        set({
          accessToken: data.accessToken,
          isAuthenticated: false,
          isLoading: false,
          error: 'MFA verification required',
        });
        return false;
      }

      set({
        accessToken: data.accessToken,
        user: data.user ?? { id: '', email },
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
      set({
        accessToken: data.accessToken,
        user: data.user ?? { id: '', email },
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
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
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
      set({
        accessToken: data.accessToken,
        isAuthenticated: true,
        isLoading: false,
        // Keep existing user info if we have it
        user: get().user ?? null,
      });
      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
