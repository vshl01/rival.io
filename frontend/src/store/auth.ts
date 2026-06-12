'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, onSessionExpired, onTokenRefreshed, setAccessToken } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  /** True until we've attempted to restore the session on first load. */
  hydrated: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (user: User, accessToken: string) => void;
  bootstrap: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      hydrated: false,
      isAuthenticated: false,

      setSession: (user, accessToken) => {
        setAccessToken(accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      login: async (email, password) => {
        const { user, accessToken } = await api.auth.login({ email, password });
        get().setSession(user, accessToken);
      },

      signup: async (name, email, password) => {
        const { user, accessToken } = await api.auth.signup({ name, email, password });
        get().setSession(user, accessToken);
      },

      logout: async () => {
        try {
          await api.auth.logout();
        } catch {
          /* ignore network errors on logout */
        }
        setAccessToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      /**
       * Restore the session on app load. The persisted access token may be
       * stale, so we verify it against /me; if that fails the api layer will
       * transparently try the httpOnly refresh cookie before giving up.
       */
      bootstrap: async () => {
        const token = get().accessToken;
        if (token) setAccessToken(token);
        try {
          const user = await api.auth.me();
          set({ user, isAuthenticated: true });
        } catch {
          setAccessToken(null);
          set({ user: null, accessToken: null, isAuthenticated: false });
        } finally {
          set({ hydrated: true });
        }
      },
    }),
    {
      name: 'rival.auth',
      // Only persist the minimum needed to restore a session.
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) setAccessToken(state.accessToken);
      },
    },
  ),
);

// Wire the api layer's lifecycle callbacks to the store exactly once.
onTokenRefreshed((token, user) => {
  useAuth.setState({ accessToken: token, user, isAuthenticated: true });
});
onSessionExpired(() => {
  setAccessToken(null);
  useAuth.setState({ user: null, accessToken: null, isAuthenticated: false });
});
