import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconRocket, IconLogin2, IconUserPlus } from '@tabler/icons-react';

import { useAuth } from '../hooks/useAuth';

import { Button, Input, Card, Spinner } from '@/components/ui';
import { useAudio } from '@/contexts/AudioContext';

export function LoginForm() {
  const { playFocus, playClick, playClickSecondary } = useAudio();
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    clearError();
    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch {}
  };

  const handleRegisterClick = () => {
    playClickSecondary();
  };

  return (
    <>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-amber-400 rounded-3xl shadow-gummy shadow-amber-fun-dark border-4 border-amber-fun-dark mb-6 rotate-3">
          <IconRocket className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl font-black text-sky-900 tracking-tight">Pixel Mentor</h1>
        <p className="text-sky-700 font-bold mt-2 text-lg">¡Tu aventura comienza aquí!</p>
      </div>

      <Card variant="mission" className="bg-white/90 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error ? (
            <div className="p-4 bg-rose-100 border-4 border-rose-300 text-rose-800 text-sm font-bold rounded-2xl text-center">
              {error}
            </div>
          ) : null}

          <Input
            label="Correo electrónico o nombre de usuario"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onFocus={playFocus}
            required
            placeholder="tu@email.com o nombre de usuario"
            autoComplete="username"
            className="border-4 rounded-2xl font-semibold"
          />

          <Input
            label="Contraseña secreta"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={playFocus}
            required
            placeholder="••••••••"
            autoComplete="current-password"
            className="border-4 rounded-2xl font-semibold"
          />

          <Button type="submit" disabled={isLoading} className="w-full mt-4 text-xl" size="lg">
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Entrando...
              </>
            ) : (
              <>
                <IconLogin2 className="w-6 h-6 mr-2" />
                ¡Entrar a la Academia!
              </>
            )}
          </Button>
        </form>
      </Card>

      <div className="mt-8 text-center bg-white/60 p-4 rounded-3xl border-4 border-white shadow-sm">
        <p className="text-sky-800 font-bold flex items-center justify-center gap-2">
          ¿Aún no tienes tu pase?
          <Link
            to="/register"
            className="text-amber-600 hover:text-amber-500 transition-colors flex items-center gap-1"
            onClick={handleRegisterClick}
          >
            <IconUserPlus className="w-5 h-5" />
            Crear cuenta
          </Link>
        </p>
      </div>
    </>
  );
}
