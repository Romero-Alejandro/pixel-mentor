import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '@pixel-mentor/shared';

import { authApi } from '../services/auth.api';

import { setToken, getToken, clearToken } from '@/services/api-client';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isValidating: boolean;
  isLoading: boolean;
  error: string | null;
  redirectPath: string | null;

  login: (identifier: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    role: Role,
    username?: string,
  ) => Promise<void>;
  checkAuth: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setAuth: (user: User, token: string) => void;
  setRedirectPath: (path: string | null) => void;
  clearRedirectPath: () => void;

  _setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false,
      isValidating: false,
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
          isValidating: false,
        });
      },

      login: async (identifier: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await authApi.login({ identifier, password });
          setToken(result.accessToken);
          set({
            user: result.user,
            token: result.accessToken,
            isAuthenticated: true,
            isLoading: false,
            isHydrated: true,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (
        email: string,
        password: string,
        name: string,
        _role: Role,
        username?: string,
      ) => {
        set({ isLoading: true, error: null });
        try {
          const result = await authApi.register({ email, password, name, username });
          setToken(result.accessToken);
          set({
            user: result.user,
            token: result.accessToken,
            isAuthenticated: true,
            isLoading: false,
            isHydrated: true,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Error al registrar';
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
        set({ isValidating: true });
        try {
          const { user } = await authApi.getCurrentUser();
          set({ user, token, isAuthenticated: true, isValidating: false });
        } catch {
          clearToken();
          set({ user: null, token: null, isAuthenticated: false, isValidating: false });
        }
      },

      clearError: () => set({ error: null }),

      setRedirectPath: (path) => set({ redirectPath: path }),

      clearRedirectPath: () => set({ redirectPath: null }),

      _setHydrated: (hydrated: boolean) => set({ isHydrated: hydrated }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('[AuthStore] Hydration error:', error);
        }
        setTimeout(() => {
          const store = useAuthStore.getState();
          store._setHydrated(true);
          store.checkAuth().catch(console.error);
        }, 0);
      },
    },
  ),
);

export function useAuthRedirect() {
  const setRedirectPath = useAuthStore((state) => state.setRedirectPath);
  const clearRedirectPath = useAuthStore((state) => state.clearRedirectPath);
  const redirectPath = useAuthStore((state) => state.redirectPath);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const saveRedirectPath = (path: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('auth-redirect-path', path);
    }
    setRedirectPath(path);
  };

  const getRedirectPath = (): string | null => {
    return (
      redirectPath ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('auth-redirect-path') : null)
    );
  };

  const clearRedirect = () => {
    clearRedirectPath();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth-redirect-path');
    }
  };

  return {
    saveRedirectPath,
    getRedirectPath,
    clearRedirect,
    redirectPath,
    isAuthenticated,
  };
}
