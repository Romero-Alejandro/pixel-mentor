import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios';
import { authApi } from '@/features/auth/services/auth.api';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to add the auth token
apiClient.interceptors.request.use((config) => {
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
  (response) => response,
  async (error: AxiosError<unknown, Record<string, unknown>>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !(originalRequest as { _retry?: boolean })._retry
    ) {
      if (isRefreshing) {
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
      if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { accessToken, refreshToken: newRefreshToken } = await authApi.refreshToken({
          refreshToken,
        });
        setToken(accessToken);
        setRefreshToken(newRefreshToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return apiClient(originalRequest as InternalAxiosRequestConfig);
      } catch (err) {
        clearToken();
        clearRefreshToken();
        processQueue(err, null);
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
