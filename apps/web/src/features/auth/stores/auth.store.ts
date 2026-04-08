import { create } from 'zustand';

interface AuthUIState {
  // Only UI state, no data fetching
  showLoginModal: boolean;
  showRegisterModal: boolean;
  authError: string | null;
  redirectPath: string | null;

  // UI actions only
  openLoginModal: () => void;
  openRegisterModal: () => void;
  closeModals: () => void;
  setAuthError: (error: string | null) => void;
  setRedirectPath: (path: string | null) => void;
  clearRedirectPath: () => void;
}

export const useAuthUIStore = create<AuthUIState>((set) => ({
  showLoginModal: false,
  showRegisterModal: false,
  authError: null,
  redirectPath: null,

  openLoginModal: () => set({ showLoginModal: true, showRegisterModal: false, authError: null }),
  openRegisterModal: () => set({ showLoginModal: false, showRegisterModal: true, authError: null }),
  closeModals: () => set({ showLoginModal: false, showRegisterModal: false, authError: null }),
  setAuthError: (error) => set({ authError: error }),
  setRedirectPath: (path) => set({ redirectPath: path }),
  clearRedirectPath: () => set({ redirectPath: null }),
}));

export function useAuthRedirect() {
  const setRedirectPath = useAuthUIStore((state) => state.setRedirectPath);
  const clearRedirectPath = useAuthUIStore((state) => state.clearRedirectPath);
  const redirectPath = useAuthUIStore((state) => state.redirectPath);

  const saveRedirectPath = (path: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('auth-redirect-path', path);
    }
    setRedirectPath(path);
  };

  const getRedirectPath = (): string | null => {
    return (
      redirectPath ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('auth-redirect-path') : null)
    );
  };

  const clearRedirect = () => {
    clearRedirectPath();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth-redirect-path');
    }
  };

  return {
    saveRedirectPath,
    getRedirectPath,
    clearRedirect,
    redirectPath,
  };
}
