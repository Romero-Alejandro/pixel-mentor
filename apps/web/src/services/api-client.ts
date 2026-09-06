import axios, { type InternalAxiosRequestConfig, type AxiosError, type AxiosResponse } from 'axios';

// Imported here despite the circular dependency with auth.api (auth.api imports
// apiClient): authApi is only referenced at runtime inside the interceptor
// callbacks, so the cycle resolves safely.
import { authApi } from '@/features/auth/services/auth.api';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
  // Required so the httpOnly refresh cookie (scoped to /api/auth by the server)
  // is sent on login/refresh/logout requests.
  withCredentials: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Token storage
//
// The ACCESS token is kept in memory only — it is never persisted, so an XSS
// can only steal a short-lived (15 min) token and there is nothing to recover
// after the page closes. The REFRESH token lives in an httpOnly cookie set by
// the server and is never exposed to JavaScript.
// ─────────────────────────────────────────────────────────────────────────────

let accessToken: string | null = null;
// Kept only for backwards compatibility with callers of the old refresh-token
// helpers; nothing in the app relies on it anymore.
let legacyRefreshTokenValue: string | null = null;

export const setToken = (token: string | null): void => {
  accessToken = token;
};

export const getToken = (): string | null => {
  return accessToken;
};

export const clearToken = (): void => {
  accessToken = null;
};

/** @deprecated The refresh token now lives in an httpOnly cookie. */
export const setRefreshToken = (token: string | null): void => {
  legacyRefreshTokenValue = token;
};

/** @deprecated The refresh token now lives in an httpOnly cookie. */
export const getRefreshToken = (): string | null => {
  return legacyRefreshTokenValue;
};

/** @deprecated The refresh token now lives in an httpOnly cookie. */
export const clearRefreshToken = (): void => {
  legacyRefreshTokenValue = null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Request interceptor: attach the in-memory access token
// ─────────────────────────────────────────────────────────────────────────────

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─────────────────────────────────────────────────────────────────────────────
// Response interceptor: transparent access-token refresh on 401
// ─────────────────────────────────────────────────────────────────────────────

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Shared refresh single-flight
//
// The refresh token ROTATES on the server: whoever uses it first invalidates
// it for everyone else (reuse is treated as a replay attack and nukes the
// whole session). On reload, the session-restore query AND any 401'd data
// request can trigger a refresh concurrently, so ALL refresh callers MUST
// share one in-flight promise instead of firing parallel rotations.
// ─────────────────────────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

/**
 * Exchange the httpOnly refresh cookie for a fresh access token.
 * Concurrent callers share the same in-flight request; once settled, the
 * next call starts a new rotation.
 */
export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = authApi
      .refreshToken()
      .then(({ accessToken: newAccessToken }) => {
        setToken(newAccessToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        return newAccessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Requests that must never trigger an automatic refresh cycle. */
function isAuthEndpoint(url: string | undefined): boolean {
  return url === '/api/auth/login' || url === '/api/auth/register' || url === '/api/auth/refresh';
}

function handleRefreshFailure(): void {
  clearToken();
  // Only hard-redirect when we are not already on a public page, to avoid
  // redirect loops (e.g. a failed login attempt).
  if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    window.location.href = '/login';
  }
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<unknown, Record<string, unknown>>) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    const isUnauthorized = error.response?.status === 401;
    const shouldAttemptRefresh =
      isUnauthorized &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url);

    if (!shouldAttemptRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      // Shared single-flight: concurrent 401s reuse the same rotation.
      const newAccessToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearToken();
      handleRefreshFailure();
      return Promise.reject(refreshError);
    }
  },
);
