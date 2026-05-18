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
import { useState, useEffect } from 'react';

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface UseAuthOptions {
  /** Disable eager user fetching on public routes. Pass false on PublicRoute. */
  isProtected?: boolean;
}

export function useAuth(options: UseAuthOptions = {}) {
  const { isProtected = true } = options;
  const queryClient = useQueryClient();

  // Track initial hydration/completion state to avoid showing spinner prematurely
  // For non-protected routes (isProtected=false), hydration is immediate since no query runs
  const [isHydrated, setIsHydrated] = useState(!isProtected);

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

  // Only run the query on protected routes or when isProtected is true.
  // On public routes (isProtected=false), the query is disabled so:
  // - If token exists: isLoading=true (shows spinner) → user stays on public route
  // - If no token: isLoading=false (renders page) → login/register works normally
  const shouldFetch = isProtected && !!getToken();

  const userQuery = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      // Mark hydration complete after first successful fetch
      setIsHydrated(true);
      // The try/catch block was removed to allow the Axios interceptor to handle auth errors.
      // Previously, catching the error and returning null caused a race condition where
      // the app would redirect to /login before the token could be refreshed.
      const { user } = await authApi.getCurrentUser();
      return user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 0, // Don't retry - let the interceptor handle 401 and redirect
    enabled: shouldFetch,
    // Use cached user as initial data to reduce flickering while fetching
    initialData: () => {
      const cachedUser = queryClient.getQueryData<User>(['user']);
      if (cachedUser) {
        setIsHydrated(true);
      }
      return cachedUser;
    },
  });

  // Mark as hydrated if there's cached data from previous session
  useEffect(() => {
    if (userQuery.data && !isHydrated) {
      setIsHydrated(true);
    }
  }, [userQuery.data, isHydrated]);

  // Mark as hydrated if query fails (e.g., 401) - don't keep spinner forever
  useEffect(() => {
    if (userQuery.isError && !isHydrated) {
      setIsHydrated(true);
    }
  }, [userQuery.isError, isHydrated]);

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
    isHydrated,
    isError: userQuery.isError,
    // A user is authenticated if the query returned data.
    // This prevents a flicker of unauthenticated state during token refresh.
    isAuthenticated: !!userQuery.data,
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
