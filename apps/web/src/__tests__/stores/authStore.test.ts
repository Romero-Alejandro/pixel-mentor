import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAuthStore } from '../../features/auth/stores/auth.store';
import { authApi } from '../../features/auth/services/auth.api';
import { setToken, clearToken } from '../../services/api-client';

// Mock the API functions
vi.spyOn(authApi, 'login');
vi.spyOn(authApi, 'register');
vi.spyOn(authApi, 'getCurrentUser');

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isHydrated: false,
      isValidating: false,
    });
  });

  describe('initial state', () => {
    it('should have null user and token initially', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('login', () => {
    it('should login successfully and set user state', async () => {
      const mockResponse = {
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 },
        token: 'jwt-token-123',
      };
      (authApi.login as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      await useAuthStore.getState().login('test@test.com', 'password123');

      expect(authApi.login).toHaveBeenCalledWith({
        identifier: 'test@test.com',
        password: 'password123',
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockResponse.user);
      expect(state.token).toBe(mockResponse.token);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should handle login error', async () => {
      const errorMessage = 'Invalid credentials';
      (authApi.login as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error(errorMessage));

      await expect(useAuthStore.getState().login('test@test.com', 'wrong')).rejects.toThrow();

      const state = useAuthStore.getState();
      expect(state.error).toBe(errorMessage);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('register', () => {
    it('should register successfully and set user state', async () => {
      const mockResponse = {
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 },
        token: 'jwt-token-123',
      };
      (authApi.register as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      await useAuthStore
        .getState()
        .register('test@test.com', 'password123', 'Test User', 'STUDENT');

      expect(authApi.register).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
        name: 'Test User',
        username: undefined,
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockResponse.user);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('logout', () => {
    it('should clear user and token on logout', () => {
      useAuthStore.setState({
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 },
        token: 'some-token',
        isAuthenticated: true,
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('checkAuth', () => {
    it('should set user when token exists and API call succeeds', async () => {
      setToken('valid-token');
      const mockUser = { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 };
      (authApi.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        user: mockUser,
      });

      await useAuthStore.getState().checkAuth();

      expect(authApi.getCurrentUser).toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
    });

    it('should clear auth when token exists but API call fails', async () => {
      setToken('invalid-token');
      (authApi.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Unauthorized'),
      );

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should do nothing when no token exists', async () => {
      clearToken();

      await useAuthStore.getState().checkAuth();

      expect(authApi.getCurrentUser).not.toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setAuth', () => {
    it('should set user and token directly', () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        role: 'STUDENT' as const,
        quota: 0,
      };

      useAuthStore.getState().setAuth(mockUser, 'direct-token');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('direct-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isHydrated).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should clear error on clearError', () => {
      useAuthStore.setState({ error: 'Some error' });

      useAuthStore.getState().clearError();

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('redirect path', () => {
    it('should set redirect path', () => {
      useAuthStore.getState().setRedirectPath('/dashboard');

      const state = useAuthStore.getState();
      expect(state.redirectPath).toBe('/dashboard');
    });

    it('should clear redirect path', () => {
      useAuthStore.setState({ redirectPath: '/dashboard' });

      useAuthStore.getState().clearRedirectPath();

      const state = useAuthStore.getState();
      expect(state.redirectPath).toBeNull();
    });
  });
});
