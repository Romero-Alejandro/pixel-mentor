import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconRocket } from '@tabler/icons-react';

import { useAuthStore } from '../stores/authStore';
import { Button, Input, Card, Spinner } from '../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-sky-100 p-6">
      <div className="w-full max-w-sm">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-sky-400 to-sky-600 rounded-3xl shadow-lg shadow-sky-200 mb-4">
            <IconRocket className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Pixel Mentor</h1>
          <p className="text-slate-500 mt-1">Tu asistente de aprendizaje</p>
        </div>

        <Card variant="elevated" padding="lg" className="shadow-xl shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-medium rounded-xl text-center">
                {error}
              </div>
            ) : null}

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
              placeholder="••••••••"
              autoComplete="current-password"
            />

            <Button type="submit" disabled={isLoading} className="w-full mt-2" size="lg">
              {isLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Entrando...
                </>
              ) : (
                <>
                  <IconRocket className="w-5 h-5 mr-2" />
                  ¡Comenzar!
                </>
              )}
            </Button>
          </form>
        </Card>

        <p className="mt-8 text-center text-slate-600 font-medium">
          ¿Sin cuenta?{' '}
          <Link
            to="/register"
            className="text-sky-600 hover:text-sky-700 font-semibold transition-colors"
          >
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
