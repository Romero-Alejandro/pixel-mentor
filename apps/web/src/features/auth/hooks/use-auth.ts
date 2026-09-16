import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type User } from '@/features/auth/services/auth.api';
import { setToken, getToken, clearToken, refreshAccessToken } from '@/services/api-client';
import { useAuthUIStore } from '@/features/auth/stores/auth.store';
import { closeAudioContext } from '@/audio/micro/zzfx';

import { logger } from '@/utils/logger';
import { useState, useEffect } from 'react';

interface AuthResponse {
  user: User;
  accessToken: string;
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

  // Only run the query on protected routes. On public routes (isProtected=false)
  // the query is disabled so login/register work normally.
  const shouldFetch = isProtected;

  const userQuery = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      // Mark hydration complete after first successful fetch
      setIsHydrated(true);

      // Session restore: after a page reload there is no access token in memory
      // (it is never persisted). If the httpOnly refresh cookie is still valid,
      // exchange it silently for a fresh access token before fetching the user.
      // Uses the shared single-flight so this never races 401-triggered
      // refreshes from the interceptor into a double rotation (which the
      // server treats as a replay attack and nukes the session).
      if (!getToken()) {
        try {
          await refreshAccessToken();
        } catch {
          throw new Error('No active session');
        }
      }

      // Errors bubble up so ProtectedRoute redirects to /login; the Axios
      // interceptor handles access-token expiry transparently.
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

  // Safety: if query is still pending after 8s, mark hydrated so redirect can happen
  useEffect(() => {
    if (isHydrated || !shouldFetch) return;
    const timer = setTimeout(() => {
      if (!isHydrated) {
        logger.warn('[useAuth] Hydration safety timeout — forcing hydration after 8s');
        setIsHydrated(true);
      }
    }, 8_000);
    return () => clearTimeout(timer);
  }, [isHydrated, shouldFetch]);

  // Fix: when query is disabled (no token + protected route), hydration would never complete
  // causing infinite "Verificando pase de explorador..." spinner. Mark hydrated immediately
  // so ProtectedRoute can redirect to /login.
  useEffect(() => {
    if (!shouldFetch && !isHydrated) {
      setIsHydrated(true);
    }
  }, [shouldFetch, isHydrated]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { identifier: string; password: string }) => {
      const result = await authApi.login(credentials);
      return result as AuthResponse;
    },
    onSuccess: (data) => {
      // The refresh token is delivered by the server as an httpOnly cookie.
      setToken(data.accessToken);
      queryClient.setQueryData(['user'], data.user);
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
      // The refresh token is delivered by the server as an httpOnly cookie.
      setToken(data.accessToken);
      queryClient.setQueryData(['user'], data.user);
    },
  });

  const cleanupUserState = () => {
    clearToken();
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
      try {
        // The server revokes the session identified by the httpOnly refresh
        // cookie and clears it; no access token is required for this call.
        await authApi.logout();
      } catch (error) {
        logger.error('Logout API call failed', error);
      }
    },
    onSettled: () => {
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
