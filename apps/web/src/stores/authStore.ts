import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

  // actions (existing)
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: Role) => Promise<void>;
  checkAuth: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setAuth: (user: User, token: string) => void;

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

// Subscribe to hydration completion as a backup/additional trigger
// This ensures hydration is marked complete even if the callback misses
useAuthStore.persist.onFinishHydration(() => {
  const currentState = useAuthStore.getState();
  if (!currentState.isHydrated) {
    currentState._setHydrated(true);
    currentState.checkAuth().catch(console.error);
  }
});
