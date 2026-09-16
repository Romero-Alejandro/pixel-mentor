import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { RegisterPage } from '@/pages/RegisterPage';

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

// Mock the useAuth hook
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: vi.fn(),
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

import { useAuth } from '@/features/auth/hooks/use-auth';

describe('RegisterPage', () => {
  const mockRegister = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      register: mockRegister,
      clearError: mockClearError,
      isLoading: false,
      isRegistering: false,
      error: null,
    });
  });

  it('should render registration form with all fields', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByLabelText('Tu apodo (Opcional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña secreta')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirma tu contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear Personaje!/i })).toBeInTheDocument();
    expect(screen.getByText(/Únete a la academia mágica/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volver/i })).toHaveAttribute('href', '/login');
  });

  it('should show error message when hook has error', () => {
    (useAuth as any).mockReturnValue({
      register: mockRegister,
      clearError: mockClearError,
      isLoading: false,
      isRegistering: false,
      error: 'Email already exists',
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Email already exists')).toBeInTheDocument();
  });

  it('should show validation error when passwords do not match', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    const nameInput = screen.getByLabelText('Nombre completo');
    const emailInput = screen.getByLabelText('Correo electrónico');
    const passwordInput = screen.getByLabelText('Contraseña secreta');
    const confirmPasswordInput = screen.getByLabelText('Confirma tu contraseña');
    const submitButton = screen.getByRole('button', { name: /Crear Personaje!/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'different' } });
    fireEvent.click(submitButton);

    expect(screen.getByText(/Las contraseñas secretas no coinciden/i)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should show validation error when password is too short', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    const nameInput = screen.getByLabelText('Nombre completo');
    const emailInput = screen.getByLabelText('Correo electrónico');
    const passwordInput = screen.getByLabelText('Contraseña secreta');
    const confirmPasswordInput = screen.getByLabelText('Confirma tu contraseña');
    const submitButton = screen.getByRole('button', { name: /Crear Personaje!/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '12345' } });
    fireEvent.change(confirmPasswordInput, { target: { value: '12345' } });
    fireEvent.click(submitButton);

    expect(
      screen.getByText(/contraseña secreta debe tener al menos 6 caracteres/i),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should call register and navigate on successful form submission', async () => {
    mockRegister.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    const nameInput = screen.getByLabelText('Nombre completo');
    const emailInput = screen.getByLabelText('Correo electrónico');
    const passwordInput = screen.getByLabelText('Contraseña secreta');
    const confirmPasswordInput = screen.getByLabelText('Confirma tu contraseña');
    const submitButton = screen.getByRole('button', { name: /Crear Personaje!/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(mockClearError).toHaveBeenCalled();
    expect(mockRegister).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      username: '',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should display loading state during registration', () => {
    (useAuth as any).mockReturnValue({
      register: mockRegister,
      clearError: mockClearError,
      isLoading: false,
      isRegistering: true,
      error: null,
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Forjando pase...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Forjando pase/i })).toBeDisabled();
  });

  it('should clear validation errors on new input after error', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    const nameInput = screen.getByLabelText('Nombre completo');
    const emailInput = screen.getByLabelText('Correo electrónico');
    const passwordInput = screen.getByLabelText('Contraseña secreta');
    const confirmPasswordInput = screen.getByLabelText('Confirma tu contraseña');
    const submitButton = screen.getByRole('button', { name: /Crear Personaje!/i });

    // First trigger validation error
    fireEvent.change(nameInput, { target: { value: 'Test' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);

    expect(
      screen.getByText(/contraseña secreta debe tener al menos 6 caracteres/i),
    ).toBeInTheDocument();

    // Fix the password and submit again
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(
      screen.queryByText(/contraseña secreta debe tener al menos 6 caracteres/i),
    ).not.toBeInTheDocument();
    expect(mockRegister).toHaveBeenCalled();
  });
});
