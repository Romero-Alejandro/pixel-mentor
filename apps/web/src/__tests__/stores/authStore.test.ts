import { describe, it, expect, beforeEach } from 'vitest';

import { useAuthUIStore } from '../../features/auth/stores/auth.store';

describe('useAuthUIStore', () => {
  beforeEach(() => {
    useAuthUIStore.setState({
      showLoginModal: false,
      showRegisterModal: false,
      authError: null,
      redirectPath: null,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAuthUIStore.getState();
      expect(state.showLoginModal).toBe(false);
      expect(state.showRegisterModal).toBe(false);
      expect(state.authError).toBeNull();
      expect(state.redirectPath).toBeNull();
    });
  });

  describe('modal actions', () => {
    it('should open login modal', () => {
      useAuthUIStore.getState().openLoginModal();

      const state = useAuthUIStore.getState();
      expect(state.showLoginModal).toBe(true);
      expect(state.showRegisterModal).toBe(false);
      expect(state.authError).toBeNull();
    });

    it('should open register modal', () => {
      useAuthUIStore.getState().openRegisterModal();

      const state = useAuthUIStore.getState();
      expect(state.showLoginModal).toBe(false);
      expect(state.showRegisterModal).toBe(true);
      expect(state.authError).toBeNull();
    });

    it('should close modals and clear error', () => {
      useAuthUIStore.setState({
        showLoginModal: true,
        authError: 'Some error',
      });

      useAuthUIStore.getState().closeModals();

      const state = useAuthUIStore.getState();
      expect(state.showLoginModal).toBe(false);
      expect(state.showRegisterModal).toBe(false);
      expect(state.authError).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should set auth error', () => {
      useAuthUIStore.getState().setAuthError('Invalid credentials');

      const state = useAuthUIStore.getState();
      expect(state.authError).toBe('Invalid credentials');
    });

    it('should clear auth error', () => {
      useAuthUIStore.setState({ authError: 'Some error' });

      useAuthUIStore.getState().setAuthError(null);

      const state = useAuthUIStore.getState();
      expect(state.authError).toBeNull();
    });
  });

  describe('redirect path', () => {
    it('should set redirect path', () => {
      useAuthUIStore.getState().setRedirectPath('/dashboard');

      const state = useAuthUIStore.getState();
      expect(state.redirectPath).toBe('/dashboard');
    });

    it('should clear redirect path', () => {
      useAuthUIStore.setState({ redirectPath: '/dashboard' });

      useAuthUIStore.getState().clearRedirectPath();

      const state = useAuthUIStore.getState();
      expect(state.redirectPath).toBeNull();
    });
  });
});
