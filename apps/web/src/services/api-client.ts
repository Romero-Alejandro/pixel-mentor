import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios';
import { authApi } from '@/features/auth/services/auth.api';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to add the auth token
apiClient.interceptors.request.use((config) => {
  // [EDD-TEMP] Log request with auth context
  if (import.meta.env.DEV) {
    const token = getToken();
    const refreshToken = getRefreshToken();
    console.debug(
      `[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`,
      `Request: ${config.method?.toUpperCase()} ${config.url}`,
      {
        hasToken: !!token,
        hasRefreshToken: !!refreshToken,
        currentRoute: window.location.pathname,
      },
    );
  }
  const token = getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: ((token: string | null) => void)[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  for (const prom of failedQueue) {
    if (error) {
      prom(null);
    } else {
      prom(token);
    }
  }
  failedQueue = [];
};

// Response interceptor for handling 401 errors
apiClient.interceptors.response.use(
  (response) => {
    // [EDD-TEMP] Log successful responses
    if (import.meta.env.DEV) {
      console.debug(`[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`, `Response success`, {
        status: response.status,
        url: response.config?.url,
      });
    }
    return response;
  },
  async (error: AxiosError<unknown, Record<string, unknown>>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined;

    // [EDD-TEMP] Log all response errors
    if (import.meta.env.DEV) {
      console.debug(`[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`, `Response error`, {
        status: error.response?.status,
        url: originalRequest?.url,
        isRefreshing,
        currentRoute: window.location.pathname,
      });
    }

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !(originalRequest as { _retry?: boolean })._retry
    ) {
      // [EDD-TEMP] Log 401 detected
      if (import.meta.env.DEV) {
        console.debug(
          `[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`,
          `401 detected, attempting token refresh`,
          { url: originalRequest.url, isRefreshing },
        );
      }

      if (isRefreshing) {
        // [EDD-TEMP] Log queueing request while refreshing
        if (import.meta.env.DEV) {
          console.debug(
            `[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`,
            `Queueing request while refreshing`,
            { url: originalRequest.url },
          );
        }
        return new Promise((resolve) => {
          failedQueue.push((token: string | null) => {
            if (token === null) {
              resolve(Promise.reject(new Error('Refresh failed')));
              return;
            }
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest as InternalAxiosRequestConfig));
          });
        });
      }

      (originalRequest as { _retry?: boolean })._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      // [EDD-TEMP] Log refresh token check
      if (import.meta.env.DEV) {
        console.debug(
          `[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`,
          `Refresh token check`,
          { hasRefreshToken: !!refreshToken },
        );
      }

      if (!refreshToken) {
        isRefreshing = false;
        // [EDD-TEMP] Log no refresh token available
        if (import.meta.env.DEV) {
          console.debug(
            `[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`,
            `No refresh token, rejecting request`,
          );
        }
        return Promise.reject(error);
      }

      try {
        // [EDD-TEMP] Log refresh attempt start
        if (import.meta.env.DEV) {
          console.debug(
            `[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`,
            `Attempting token refresh...`,
          );
        }
        const { accessToken, refreshToken: newRefreshToken } = await authApi.refreshToken({
          refreshToken,
        });
        setToken(accessToken);
        setRefreshToken(newRefreshToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);

        // [EDD-TEMP] Log refresh success
        if (import.meta.env.DEV) {
          console.debug(
            `[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`,
            `Token refresh SUCCESS`,
            { newTokenStartsWith: accessToken.substring(0, 10) },
          );
        }

        return apiClient(originalRequest as InternalAxiosRequestConfig);
      } catch (err) {
        // [EDD-TEMP] Log refresh failure with stack trace
        if (import.meta.env.DEV) {
          console.debug(
            `[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`,
            `Token refresh FAILED`,
            { error: err, stack: new Error().stack },
          );
        }
        clearToken();
        clearRefreshToken();
        processQueue(err, null);

        // [EDD-TEMP] Log forced redirect to /login
        if (import.meta.env.DEV) {
          console.debug(
            `[EDD] [${new Date().toISOString()}] [AxiosInterceptor]`,
            `REDIRECTING to /login`,
            { currentRoute: window.location.pathname },
          );
        }
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export const setToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

export const clearToken = (): void => {
  localStorage.removeItem('token');
};

export const setRefreshToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('refreshToken', token);
  } else {
    localStorage.removeItem('refreshToken');
  }
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refreshToken');
};

export const clearRefreshToken = (): void => {
  localStorage.removeItem('refreshToken');
};
