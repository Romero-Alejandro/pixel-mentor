import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { api, type User, type Role } from '../services/api';
import { setToken, getToken, clearToken } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: Role) => Promise<void>;
  checkAuth: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setAuth: (user: User, token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => {
        clearToken();
        set({ user: null, token: null, isAuthenticated: false });
      },
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await api.login({ email, password });
          setToken(result.token);
          set({ user: result.user, token: result.token, isAuthenticated: true, isLoading: false });
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
          set({ user: result.user, token: result.token, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Registration failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },
      checkAuth: async () => {
        const token = getToken();
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null });
          return;
        }
        try {
          const { user } = await api.getCurrentUser();
          set({ user, token, isAuthenticated: true });
        } catch {
          clearToken();
          set({ user: null, token: null, isAuthenticated: false });
        }
      },
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    },
  ),
);
