import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type User } from '../services/auth.api';
import {
  setToken,
  getToken,
  clearToken,
  setRefreshToken,
  getRefreshToken,
  clearRefreshToken,
} from '@/services/api-client';
import { useAuthUIStore } from '../stores/auth.store';
import { closeAudioContext } from '@/audio/micro/zzfx';

import { logger } from '@/utils/logger';

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  // [EDD-TEMP] Log session recovery attempt
  if (import.meta.env.DEV) {
    const token = getToken();
    const refreshToken = getRefreshToken();
    console.debug(`[EDD] [${new Date().toISOString()}] [useAuth]`, `Session recovery attempt`, {
      hasToken: !!token,
      tokenStartsWith: token ? token.substring(0, 10) : null,
      hasRefreshToken: !!refreshToken,
      currentRoute: window.location.pathname,
    });
  }

  const userQuery = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const token = getToken();
      // [EDD-TEMP] Log queryFn start
      if (import.meta.env.DEV) {
        console.debug(`[EDD] [${new Date().toISOString()}] [useAuth]`, `queryFn start`, {
          hasToken: !!token,
        });
      }

      if (!token) {
        // [EDD-TEMP] Log no token found
        if (import.meta.env.DEV) {
          console.debug(
            `[EDD] [${new Date().toISOString()}] [useAuth]`,
            `No token, returning null`,
          );
        }
        return null;
      }

      // [EDD-TEMP] Log before API call
      if (import.meta.env.DEV) {
        console.debug(
          `[EDD] [${new Date().toISOString()}] [useAuth]`,
          `Calling getCurrentUser API`,
        );
      }

      // The try/catch block was removed to allow the Axios interceptor to handle auth errors.
      // Previously, catching the error and returning null caused a race condition where
      // the app would redirect to /login before the token could be refreshed.
      try {
        const { user } = await authApi.getCurrentUser();
        // [EDD-TEMP] Log API success
        if (import.meta.env.DEV) {
          console.debug(`[EDD] [${new Date().toISOString()}] [useAuth]`, `getCurrentUser SUCCESS`, {
            userId: user.id,
            userRole: user.role,
          });
        }
        return user;
      } catch (err) {
        // [EDD-TEMP] Log API error
        if (import.meta.env.DEV) {
          console.debug(`[EDD] [${new Date().toISOString()}] [useAuth]`, `getCurrentUser ERROR`, {
            error: err,
            stack: new Error().stack,
          });
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // The interceptor handles 401s, so we don't need react-query to retry them.
      // It would just cause a loop. For other server errors, we can retry once.
      if (error.response?.status === 401) {
        return false;
      }
      return failureCount < 1;
    },
    enabled: !!getToken(), // Only run if we have a token
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { identifier: string; password: string }) => {
      // [EDD-TEMP] Log login attempt
      if (import.meta.env.DEV) {
        console.debug(`[EDD] [${new Date().toISOString()}] [useAuth]`, `Login mutation start`);
      }
      const result = await authApi.login(credentials);
      return result as AuthResponse;
    },
    onSuccess: (data) => {
      // [EDD-TEMP] Log login success
      if (import.meta.env.DEV) {
        console.debug(`[EDD] [${new Date().toISOString()}] [useAuth]`, `Login SUCCESS`, {
          userId: data.user.id,
          userRole: data.user.role,
        });
      }
      setToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      queryClient.setQueryData(['user'], data.user);
    },
    onError: (error) => {
      // [EDD-TEMP] Log login error
      if (import.meta.env.DEV) {
        console.debug(`[EDD] [${new Date().toISOString()}] [useAuth]`, `Login ERROR`, {
          error,
          stack: new Error().stack,
        });
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      name: string;
      username?: string;
    }) => {
      const result = await authApi.register(data);
      return result as AuthResponse;
    },
    onSuccess: (data) => {
      setToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      queryClient.setQueryData(['user'], data.user);
    },
  });

  const cleanupUserState = () => {
    clearToken();
    clearRefreshToken();
    queryClient.clear();

    useAuthUIStore.getState().closeModals();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth-redirect-path');
    }

    try {
      closeAudioContext();
    } catch (e) {
      logger.warn('Failed to close audio context', e);
    }
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // [EDD-TEMP] Log logout start
      if (import.meta.env.DEV) {
        console.debug(`[EDD] [${new Date().toISOString()}] [useAuth]`, `Logout mutation start`);
      }
      const refreshToken = getRefreshToken();
      const user = userQuery.data;
      if (refreshToken && user) {
        try {
          await authApi.logout({ userId: user.id, refreshToken });
          // [EDD-TEMP] Log logout API success
          if (import.meta.env.DEV) {
            console.debug(`[EDD] [${new Date().toISOString()}] [useAuth]`, `Logout API success`);
          }
        } catch (error) {
          logger.error('Logout API call failed', error);
          // [EDD-TEMP] Log logout API error (non-blocking)
          if (import.meta.env.DEV) {
            console.debug(
              `[EDD] [${new Date().toISOString()}] [useAuth]`,
              `Logout API error (non-blocking)`,
              { error },
            );
          }
        }
      }
    },
    onSettled: () => {
      // [EDD-TEMP] Log cleanup user state
      if (import.meta.env.DEV) {
        console.debug(
          `[EDD] [${new Date().toISOString()}] [useAuth]`,
          `Logout: cleanupUserState executed`,
        );
      }
      cleanupUserState();
    },
  });

  const error = loginMutation.error?.message || registerMutation.error?.message || null;

  const clearError = () => {
    loginMutation.reset();
    registerMutation.reset();
  };

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
    // A user is authenticated if the query is not in an error state and returns data.
    // This prevents a flicker of unauthenticated state during token refresh.
    isAuthenticated: !userQuery.isError && !!userQuery.data,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isRegistering: registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    error,
    clearError,
    refetchUser: userQuery.refetch,
  };
}
