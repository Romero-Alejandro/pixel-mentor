'use strict';

/**
 * Auth Integration Tests - Session restore with in-memory access token
 *
 * The access token is never persisted (in-memory only) and the refresh token
 * lives in an httpOnly cookie handled by the server. On protected routes the
 * hook therefore:
 * 1. Restores the session silently (calls /auth/refresh) when there is no
 *    access token in memory (e.g. after a page reload).
 * 2. Fetches the current user once an access token is available.
 * 3. Ends up unauthenticated (no redirect) when the refresh fails.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ============================================
// HOISTED MOCKS - Probes injected
// ============================================

const {
  mockGetCurrentUser,
  mockRefreshToken,
  mockRefreshAccessToken,
  mockLogin,
  mockRegister,
  mockLogout,
  mockSetToken,
  mockGetToken,
  mockClearToken,
  mockSetRefreshToken,
  mockGetRefreshToken,
  mockClearRefreshToken,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockRefreshToken: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
  mockLogin: vi.fn(),
  mockRegister: vi.fn(),
  mockLogout: vi.fn(),
  mockSetToken: vi.fn(),
  mockGetToken: vi.fn(),
  mockClearToken: vi.fn(),
  mockSetRefreshToken: vi.fn(),
  mockGetRefreshToken: vi.fn(),
  mockClearRefreshToken: vi.fn(),
}));

// ============================================
// Token STORE - Probe for controlling token state
// ============================================

const tokenStore: Record<string, string> = {};

// Token implementations with probe logic (mimic the api-client module)
mockSetToken.mockImplementation((token: string | null) => {
  if (token) tokenStore['token'] = token;
  else delete tokenStore['token'];
});
mockGetToken.mockImplementation(() => tokenStore['token'] || null);
mockClearToken.mockImplementation(() => delete tokenStore['token']);

mockSetRefreshToken.mockImplementation((token: string | null) => {
  if (token) tokenStore['refreshToken'] = token;
  else delete tokenStore['refreshToken'];
});
mockGetRefreshToken.mockImplementation(() => tokenStore['refreshToken'] || null);
mockClearRefreshToken.mockImplementation(() => delete tokenStore['refreshToken']);

// Mirror the real refreshAccessToken single-flight contract: delegate to the
// refresh endpoint probe and store the access token.
mockRefreshAccessToken.mockImplementation(async () => {
  const { accessToken } = await mockRefreshToken();
  mockSetToken(accessToken);
  return accessToken;
});

// ============================================
// MOCK @/services/api-client
// ============================================

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  setToken: mockSetToken,
  getToken: mockGetToken,
  clearToken: mockClearToken,
  refreshAccessToken: mockRefreshAccessToken,
  setRefreshToken: mockSetRefreshToken,
  getRefreshToken: mockGetRefreshToken,
  clearRefreshToken: mockClearRefreshToken,
}));

// authApi mock - Inject probes for API calls
vi.mock('@/features/auth/services/auth.api', () => ({
  authApi: {
    getCurrentUser: mockGetCurrentUser,
    refreshToken: mockRefreshToken,
    login: mockLogin,
    register: mockRegister,
    logout: mockLogout,
  },
}));

// ============================================
// IMPORTS
// ============================================

import { useAuth } from '@/features/auth/hooks/use-auth';

const mockUser = { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT' as const };

describe('Auth Integration Tests - Sesión híbrida (access en memoria + refresh cookie)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.clear();
    vi.clearAllMocks();
    Object.keys(tokenStore).forEach((key) => delete tokenStore[key]);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('ESCENARIO 1: Sin access token pero con refresh cookie válido → restaura sesión silenciosamente', async () => {
    // No access token in memory (fresh page load). The refresh endpoint
    // succeeds (server reads the httpOnly cookie) and returns a new token.
    mockRefreshToken.mockResolvedValueOnce({ accessToken: 'new.access.token' });
    mockGetCurrentUser.mockResolvedValueOnce({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // RTL waitFor retries while the callback THROWS; a falsy return resolves
    // immediately. Assert inside so an unauthenticated state keeps polling.
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true), { timeout: 3000 });

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockRefreshToken).toHaveBeenCalledWith();
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(mockSetToken).toHaveBeenCalledWith('new.access.token');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@test.com');
  });

  it('ESCENARIO 2: Sin sesión válida (refresh falla) → isAuthenticated false, no se pide el usuario', async () => {
    mockRefreshToken.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Invalid refresh token' } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(
      () => {
        if (result.current.isLoading || result.current.isAuthenticated) {
          throw new Error('session not settled yet');
        }
      },
      { timeout: 5000 },
    );

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('ESCENARIO 3: Access token válido en memoria → no llama a refresh', async () => {
    tokenStore['token'] = 'valid.access.token';
    mockGetCurrentUser.mockResolvedValueOnce({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true), { timeout: 5000 });

    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('ESCENARIO 4: Login guarda solo el access token (el refresh va en cookie)', async () => {
    mockLogin.mockResolvedValueOnce({
      user: mockUser,
      accessToken: 'login.access.token',
    });
    mockGetCurrentUser.mockResolvedValueOnce({ user: mockUser });

    // Queue the session-restore mock BEFORE mounting: the queryFn fires during
    // the initial act flush, so a once-implementation added afterwards is missed.
    mockRefreshToken.mockResolvedValueOnce({ accessToken: 'restored.access.token' });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true), { timeout: 5000 });

    await result.current.login({ identifier: 'test@test.com', password: 'secret123' });

    expect(mockSetToken).toHaveBeenLastCalledWith('login.access.token');
    // The refresh token must never be stored client-side.
    expect(mockSetRefreshToken).not.toHaveBeenCalled();
    expect(tokenStore['refreshToken']).toBeUndefined();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('ESCENARIO 5: Logout no requiere datos del usuario (solo limpia la sesión local)', async () => {
    tokenStore['token'] = 'valid.access.token';
    mockGetCurrentUser.mockResolvedValueOnce({ user: mockUser });
    mockLogout.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true), { timeout: 5000 });
    expect(result.current.isAuthenticated).toBe(true);

    await result.current.logout();

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledWith();
    expect(mockClearToken).toHaveBeenCalled();
    expect(tokenStore['token']).toBeUndefined();
  });
});
