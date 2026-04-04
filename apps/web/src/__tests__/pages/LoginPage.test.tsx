import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { LoginPage } from '../../pages/LoginPage';

// Mock AudioContext
const mockAudio = {
  playFocus: vi.fn(),
  playClick: vi.fn(),
  playClickSecondary: vi.fn(),
  playSprite: vi.fn(),
  playMicro: vi.fn(),
  playRive: vi.fn(),
};
vi.mock('@/contexts/AudioContext', () => ({
  useAudio: () => mockAudio,
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the entire authStore module
vi.mock('../../features/auth/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { useAuthStore } from '../../features/auth/stores/auth.store';

describe('LoginPage', () => {
  const mockLogin = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as any).mockReturnValue({
      login: mockLogin,
      clearError: mockClearError,
      isLoading: false,
      error: null,
      user: null,
      token: null,
      isAuthenticated: false,
      logout: vi.fn(),
      checkAuth: vi.fn(),
    });
  });

  it('should render login form with all fields', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/Correo electrónico o nombre de usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña secreta/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar a la Academia!/i })).toBeInTheDocument();
    expect(screen.getByText(/¿Aún no tienes tu pase?/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Crear cuenta/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('should show error message when store has error', () => {
    (useAuthStore as any).mockReturnValue({
      login: mockLogin,
      clearError: mockClearError,
      isLoading: false,
      error: 'Invalid credentials',
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('should update email and password fields on input', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/Correo electrónico o nombre de usuario/i);
    const passwordInput = screen.getByLabelText(/Contraseña secreta/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('should call login and navigate on successful form submission', async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/Correo electrónico o nombre de usuario/i);
    const passwordInput = screen.getByLabelText(/Contraseña secreta/i);
    const submitButton = screen.getByRole('button', { name: /Entrar a la Academia!/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(mockClearError).toHaveBeenCalled();
    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should display loading state during login', () => {
    (useAuthStore as any).mockReturnValue({
      login: mockLogin,
      clearError: mockClearError,
      isLoading: true,
      error: null,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Entrando...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrando\.\.\./i })).toBeDisabled();
  });
});
