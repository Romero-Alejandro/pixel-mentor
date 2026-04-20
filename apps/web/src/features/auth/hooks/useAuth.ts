import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type User } from '../services/auth.api';
import { setToken, getToken, clearToken } from '@/services/api-client';
import { useAuthUIStore } from '../stores/auth.store';
import { closeAudioContext } from '@/audio/micro/zzfx';

import { logger } from '@/utils/logger';

interface AuthResponse {
  user: User;
  accessToken: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  // Query for current user - fetches from /auth/me
  const userQuery = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const token = getToken();
      if (!token) return null;
      try {
        const { user } = await authApi.getCurrentUser();
        return user;
      } catch {
        clearToken();
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    enabled: !!getToken(), // Only run if we have a token
  });

  // Mutation for login
  const loginMutation = useMutation({
    mutationFn: async (credentials: { identifier: string; password: string }) => {
      const result = await authApi.login(credentials);
      return {
        user: result.user,
        accessToken: result.accessToken,
      } as AuthResponse;
    },
    onSuccess: (data) => {
      setToken(data.accessToken);
      queryClient.setQueryData(['user'], data.user);
    },
  });

  // Mutation for register
  const registerMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      name: string;
      username?: string;
    }) => {
      const result = await authApi.register(data);
      return {
        user: result.user,
        accessToken: result.accessToken,
      } as AuthResponse;
    },
    onSuccess: (data) => {
      setToken(data.accessToken);
      queryClient.setQueryData(['user'], data.user);
    },
  });

  /**
   * Cleans up all user-specific global state on logout.
   * Preserves user preferences (volume, muted) that persist across sessions.
   */
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

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {},
    onSettled: () => {
      cleanupUserState();
    },
  });

  // Combined error for login/register
  const error = loginMutation.error?.message || registerMutation.error?.message || null;

  // Clear error function
  const clearError = () => {
    loginMutation.reset();
    registerMutation.reset();
  };

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
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
