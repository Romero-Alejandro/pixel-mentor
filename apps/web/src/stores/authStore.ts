import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCallback } from 'react';

import { api, type User, type Role } from '../services/api';
import { setToken, getToken, clearToken } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean; // NEW: tracks Zustand hydration completion
  isValidating: boolean; // NEW: tracks auth check in progress
  isLoading: boolean;
  error: string | null;
  // Auth redirect state
  redirectPath: string | null;

  // actions (existing)
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: Role) => Promise<void>;
  checkAuth: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setAuth: (user: User, token: string) => void;
  setRedirectPath: (path: string | null) => void;
  clearRedirectPath: () => void;

  // NEW: internal hydration marker
  _setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false, // NEW: default false
      isValidating: false, // NEW: default false
      isLoading: false,
      error: null,
      redirectPath: null,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true, isHydrated: true }),
      logout: () => {
        clearToken();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isHydrated: false, // NEW: force re-hydration check on next load
          isValidating: false,
        });
      },
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await api.login({ email, password });
          setToken(result.token);
          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
            isLoading: false,
            isHydrated: true,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },
      register: async (email: string, password: string, name: string, role: Role) => {
        set({ isLoading: true, error: null });
        try {
          const result = await api.register({ email, password, name, role });
          setToken(result.token);
          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
            isLoading: false,
            isHydrated: true,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Registration failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },
      checkAuth: async () => {
        const token = getToken();
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null, isValidating: false });
          return;
        }
        set({ isValidating: true }); // NEW: mark validation in progress
        try {
          const { user } = await api.getCurrentUser();
          set({ user, token, isAuthenticated: true, isValidating: false });
        } catch {
          clearToken();
          set({ user: null, token: null, isAuthenticated: false, isValidating: false });
        }
      },
      clearError: () => set({ error: null }),
      setRedirectPath: (path) => set({ redirectPath: path }),
      clearRedirectPath: () => set({ redirectPath: null }),
      _setHydrated: (hydrated: boolean) => set({ isHydrated: hydrated }), // NEW: internal hydration marker
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (_state, error) => {
        // This callback runs after hydration completes
        // We use setTimeout to avoid accessing useAuthStore before it's fully initialized
        if (error) {
          console.error('[AuthStore] Hydration error:', error);
        }
        // Defer the state update to the next tick to ensure store is initialized
        setTimeout(() => {
          const store = useAuthStore.getState();
          store._setHydrated(true);
          store.checkAuth().catch(console.error);
        }, 0);
      },
    },
  ),
);

// ─── Auth Redirect Helpers ──────────────────────────────────────────────────────

/**
 * Hook to manage auth redirect flow
 * Call this on pages that need to redirect to login/register
 */
export function useAuthRedirect() {
  const setRedirectPath = useAuthStore((state) => state.setRedirectPath);
  const clearRedirectPath = useAuthStore((state) => state.clearRedirectPath);
  const redirectPath = useAuthStore((state) => state.redirectPath);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  /**
   * Save the current path for redirect after login
   */
  const saveRedirectPath = useCallback(
    (path: string) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth-redirect-path', path);
      }
      setRedirectPath(path);
    },
    [setRedirectPath],
  );

  /**
   * Get the saved redirect path
   */
  const getRedirectPath = useCallback((): string | null => {
    // Priority: Zustand store > sessionStorage
    return (
      redirectPath ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('auth-redirect-path') : null)
    );
  }, [redirectPath]);

  /**
   * Clear the saved redirect path
   */
  const clearRedirect = useCallback(() => {
    clearRedirectPath();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth-redirect-path');
    }
  }, [clearRedirectPath]);

  return {
    saveRedirectPath,
    getRedirectPath,
    clearRedirect,
    redirectPath,
    isAuthenticated,
  };
}
