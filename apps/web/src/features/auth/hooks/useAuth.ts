import { useAuthStore, useAuthRedirect } from '../stores/auth.store';

export function useAuth() {
  const {
    user,
    token,
    isAuthenticated,
    isHydrated,
    isValidating,
    isLoading,
    error,
    login,
    register,
    logout,
    checkAuth,
    clearError,
    setAuth,
    setRedirectPath,
    clearRedirectPath,
  } = useAuthStore();

  return {
    user,
    token,
    isAuthenticated,
    isHydrated,
    isValidating,
    isLoading,
    error,
    login,
    register,
    logout,
    checkAuth,
    clearError,
    setAuth,
    setRedirectPath,
    clearRedirectPath,
  };
}

export { useAuthRedirect };
