import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { RegisterPage } from '../../pages/RegisterPage';
import { useAuthStore } from '../../features/auth/stores/auth.store';

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

describe('RegisterPage', () => {
  const mockRegister = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as any).mockReturnValue({
      register: mockRegister,
      clearError: mockClearError,
      isLoading: false,
      error: null,
    });
  });

  it('should render registration form with all fields', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Designación (Nombre)')).toBeInTheDocument();
    expect(screen.getByLabelText('Identificador (Email)')).toBeInTheDocument();
    expect(screen.getByLabelText('Clave de acceso')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar clave')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar/i })).toBeInTheDocument();
    expect(screen.getByText(/¿Registro existente\?/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Autenticarse/i })).toHaveAttribute('href', '/login');
  });

  it('should show error message when store has error', () => {
    (useAuthStore as any).mockReturnValue({
      register: mockRegister,
      clearError: mockClearError,
      isLoading: false,
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

    const nameInput = screen.getByLabelText('Designación (Nombre)');
    const emailInput = screen.getByLabelText('Identificador (Email)');
    const passwordInput = screen.getByLabelText('Clave de acceso');
    const confirmPasswordInput = screen.getByLabelText('Confirmar clave');
    const submitButton = screen.getByRole('button', { name: /Registrar/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'different' } });
    fireEvent.click(submitButton);

    expect(screen.getByText('Las claves de acceso no coinciden.')).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should show validation error when password is too short', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    const nameInput = screen.getByLabelText('Designación (Nombre)');
    const emailInput = screen.getByLabelText('Identificador (Email)');
    const passwordInput = screen.getByLabelText('Clave de acceso');
    const confirmPasswordInput = screen.getByLabelText('Confirmar clave');
    const submitButton = screen.getByRole('button', { name: /Registrar/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '12345' } });
    fireEvent.change(confirmPasswordInput, { target: { value: '12345' } });
    fireEvent.click(submitButton);

    expect(screen.getByText('La clave requiere un mínimo de 6 caracteres.')).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should call register and navigate on successful form submission', async () => {
    mockRegister.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    const nameInput = screen.getByLabelText('Designación (Nombre)');
    const emailInput = screen.getByLabelText('Identificador (Email)');
    const passwordInput = screen.getByLabelText('Clave de acceso');
    const confirmPasswordInput = screen.getByLabelText('Confirmar clave');
    const submitButton = screen.getByRole('button', { name: /Registrar/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(mockClearError).toHaveBeenCalled();
    expect(mockRegister).toHaveBeenCalledWith(
      'test@example.com',
      'password123',
      'Test User',
      'STUDENT',
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should display loading state during registration', () => {
    (useAuthStore as any).mockReturnValue({
      register: mockRegister,
      clearError: mockClearError,
      isLoading: true,
      error: null,
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Procesando...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Procesando\.\.\./i })).toBeDisabled();
  });

  it('should clear validation errors on new input after error', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    const nameInput = screen.getByLabelText('Designación (Nombre)');
    const emailInput = screen.getByLabelText('Identificador (Email)');
    const passwordInput = screen.getByLabelText('Clave de acceso');
    const confirmPasswordInput = screen.getByLabelText('Confirmar clave');
    const submitButton = screen.getByRole('button', { name: /Registrar/i });

    // First trigger validation error
    fireEvent.change(nameInput, { target: { value: 'Test' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);

    expect(screen.getByText('La clave requiere un mínimo de 6 caracteres.')).toBeInTheDocument();

    // Fix the password and submit again
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(
      screen.queryByText('La clave requiere un mínimo de 6 caracteres.'),
    ).not.toBeInTheDocument();
    expect(mockRegister).toHaveBeenCalled();
  });
});
