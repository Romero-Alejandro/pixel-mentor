import { describe, it, expect, beforeEach, vi } from 'vitest';

import { api, getToken, clearToken } from '../services/api';

import { useAuthStore } from './authStore';

// Mock the module completely
vi.mock('../services/api', () => ({
  api: {
    getCurrentUser: vi.fn(),
  },
  getToken: vi.fn(),
  clearToken: vi.fn(),
}));

const mockedGetToken = getToken as ReturnType<typeof vi.fn>;
const mockedClearToken = clearToken as ReturnType<typeof vi.fn>;
const mockedGetCurrentUser = api.getCurrentUser as ReturnType<typeof vi.fn>;

describe('hydration behavior', () => {
  beforeEach(() => {
    mockedGetToken.mockReturnValue(null);
    mockedClearToken.mockClear();
    mockedGetCurrentUser.mockClear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false,
      isValidating: false,
      isLoading: false,
      error: null,
    });
  });

  it('should set isHydrated to false initially', () => {
    expect(useAuthStore.getState().isHydrated).toBe(false);
  });

  it('should set isHydrated to true on _setHydrated', () => {
    useAuthStore.getState()._setHydrated(true);
    expect(useAuthStore.getState().isHydrated).toBe(true);
  });

  it('should set isValidating to true during checkAuth', async () => {
    mockedGetToken.mockReturnValue('valid-token');
    useAuthStore.getState()._setHydrated(true);

    const checkAuthPromise = useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState().isValidating).toBe(true);

    await checkAuthPromise;
    expect(useAuthStore.getState().isValidating).toBe(false);
  });

  it('should keep isHydrated true on logout', () => {
    useAuthStore.setState({ isHydrated: true, isAuthenticated: true });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isHydrated).toBe(true);
  });

  it('should set isAuthenticated false and isValidating false on checkAuth with no token', async () => {
    mockedGetToken.mockReturnValue(null);
    useAuthStore.getState()._setHydrated(true);

    await useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isValidating).toBe(false);
  });

  it('should set user and token on successful checkAuth', async () => {
    const mockUser = { id: 1, email: 'test@example.com', name: 'Test' };
    mockedGetToken.mockReturnValue('valid-token');
    mockedGetCurrentUser.mockResolvedValue({ user: mockUser });

    useAuthStore.getState()._setHydrated(true);
    await useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().token).toBe('valid-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should clear token and set unauthenticated on failed checkAuth', async () => {
    mockedGetToken.mockReturnValue('invalid-token');
    mockedGetCurrentUser.mockRejectedValue(new Error('Invalid token'));

    useAuthStore.getState()._setHydrated(true);
    await useAuthStore.getState().checkAuth();

    expect(mockedClearToken).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
