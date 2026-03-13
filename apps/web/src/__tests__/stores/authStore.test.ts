import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

vi.spyOn(api, 'login');
vi.spyOn(api, 'register');
vi.spyOn(api, 'getCurrentUser');

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
      (api.login as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      await useAuthStore.getState().login('test@test.com', 'password123');

      expect(api.login).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockResponse.user);
      expect(state.token).toBe('jwt-token-123');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error on login failure', async () => {
      (api.login as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Invalid credentials'),
      );

      await expect(
        useAuthStore.getState().login('test@test.com', 'wrong-password'),
      ).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.error).toBe('Invalid credentials');
      expect(state.isLoading).toBe(false);
    });

    it('should set loading state during login', async () => {
      let loadingDuringCall = false;
      (api.login as ReturnType<typeof vi.fn>).mockImplementation(() => {
        loadingDuringCall = useAuthStore.getState().isLoading;
        return Promise.resolve({
          user: { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 },
          token: 'token',
        });
      });

      await useAuthStore.getState().login('test@test.com', 'password');

      expect(loadingDuringCall).toBe(true);
    });
  });

  describe('register', () => {
    it('should register successfully and set user state', async () => {
      const mockResponse = {
        user: { id: '2', email: 'new@test.com', name: 'New User', role: 'STUDENT', quota: 0 },
        token: 'jwt-token-456',
      };
      (api.register as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      await useAuthStore.getState().register('new@test.com', 'password123', 'New User', 'STUDENT');

      expect(api.register).toHaveBeenCalledWith({
        email: 'new@test.com',
        password: 'password123',
        name: 'New User',
        role: 'STUDENT',
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockResponse.user);
      expect(state.token).toBe('jwt-token-456');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should set error on registration failure', async () => {
      (api.register as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Email already exists'),
      );

      await expect(
        useAuthStore.getState().register('existing@test.com', 'password', 'Name', 'STUDENT'),
      ).rejects.toThrow('Email already exists');

      const state = useAuthStore.getState();
      expect(state.error).toBe('Email already exists');
    });
  });

  describe('logout', () => {
    it('should clear user state on logout', async () => {
      (api.login as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 },
        token: 'jwt-token',
      });

      await useAuthStore.getState().login('test@test.com', 'password');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('checkAuth', () => {
    it('should authenticate if token exists and is valid', async () => {
      localStorage.setItem('token', 'existing-token');
      useAuthStore.setState({ token: 'existing-token' });
      (api.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 },
      });

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual({
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        role: 'STUDENT',
        quota: 0,
      });
    });

    it('should not authenticate if no token', async () => {
      useAuthStore.setState({ token: null });

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(api.getCurrentUser).not.toHaveBeenCalled();
    });

    it('should clear auth state if token is invalid', async () => {
      useAuthStore.setState({ token: 'invalid-token' });
      (api.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Unauthorized'),
      );

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useAuthStore.setState({ error: 'Some error' });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
