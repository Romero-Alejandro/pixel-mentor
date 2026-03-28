import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconUserPlus, IconArrowLeft } from '@tabler/icons-react';

import { useAuthStore } from '../stores/authStore';
import { Button, Input, Card } from '../components/ui';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (password !== confirmPassword) {
      setValidationError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setValidationError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    // Validate username if provided
    if (username) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(username)) {
        setUsernameError(
          'El nombre de usuario debe tener entre 3 y 30 caracteres, y solo puede contener letras, números y guiones bajos.',
        );
        return;
      }
    }

    try {
      await register(email, password, name, 'STUDENT', username);
      navigate('/dashboard');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Back link */}
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors mb-6"
        >
          <IconArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Volver</span>
        </Link>

        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl shadow-lg mb-4 mx-auto">
            <IconUserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Crear Cuenta</h1>
          <p className="text-slate-500 mt-1">Únete a Pixel Mentor</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error || validationError || usernameError ? (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                {error || validationError || usernameError}
              </div>
            ) : null}

            <Input
              label="Nombre completo"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Tu nombre"
              autoComplete="name"
            />

            <Input
              label="Nombre de usuario (opcional)"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase());
                setUsernameError('');
              }}
              placeholder="tu_nombre_de_usuario"
              autoComplete="username"
            />

            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              autoComplete="email"
            />

            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />

            <Input
              label="Confirmar contraseña"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Repite tu contraseña"
              autoComplete="new-password"
            />

            <Button type="submit" disabled={isLoading} className="w-full mt-2">
              {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-slate-600">
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            className="text-slate-800 font-semibold hover:text-sky-600 transition-colors"
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
