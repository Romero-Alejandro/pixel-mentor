import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconRocket, IconLogin2, IconUserPlus, IconAlertCircleFilled } from '@tabler/icons-react';

import { useAuth } from '../hooks/useAuth';
import { Button, Input, Card, Spinner } from '@/components/ui';
import { useAudio } from '@/contexts/AudioContext';

export function LoginForm() {
  const { playFocus, playClick, playClickSecondary } = useAudio();
  const navigate = useNavigate();
  const { login, error, clearError, isLoggingIn } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    clearError();
    try {
      await login({ identifier, password });
      navigate('/dashboard');
    } catch {}
  };

  const handleRegisterClick = () => {
    playClickSecondary();
  };

  return (
    <>
      <div className="text-center mb-8">
        <div className="relative inline-flex items-center justify-center w-24 h-24 bg-amber-400 rounded-[2rem] shadow-[0_8px_0_0_#d97706] border-4 border-white mb-6 rotate-3 hover:rotate-6 transition-transform duration-300">
          <IconRocket className="w-12 h-12 text-white drop-shadow-md" stroke={2.5} />
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-sky-400 rounded-full animate-ping opacity-75" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-sky-900 tracking-tight drop-shadow-sm">
          Pixel Mentor
        </h1>
        <p className="text-sky-600 font-bold mt-2 text-lg">¡Tu aventura comienza aquí!</p>
      </div>

      <Card className="bg-white/95 backdrop-blur-md rounded-[2.5rem] border-4 border-white shadow-[0_12px_40px_rgba(14,165,233,0.15)] p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error ? (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border-4 border-rose-200 text-rose-700 text-sm font-bold rounded-2xl animate-bounce-in">
              <IconAlertCircleFilled className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="space-y-4">
            <Input
              label="Usuario o Correo"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onFocus={playFocus}
              required
              placeholder="tu@email.com o tu apodo"
              autoComplete="username"
              className="border-4 border-slate-200 rounded-2xl font-bold px-4 py-3 bg-slate-50 focus:bg-white focus:border-sky-400 transition-colors shadow-inner"
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
              className="border-4 border-slate-200 rounded-2xl font-bold px-4 py-3 bg-slate-50 focus:bg-white focus:border-sky-400 transition-colors shadow-inner"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoggingIn}
            className="w-full mt-6 text-xl bg-sky-500 hover:bg-sky-400 border-4 border-sky-600 shadow-[0_6px_0_0_#0284c7] hover:-translate-y-1 active:translate-y-[6px] active:border-b-0 active:shadow-none hover:shadow-[0_8px_0_0_#0284c7] transition-all rounded-[1.5rem] py-4 font-black flex items-center justify-center focus-visible:ring-4 focus-visible:ring-sky-200 outline-none"
          >
            {isLoggingIn ? (
              <>
                <Spinner size="sm" className="mr-3" />
                Abriendo portal...
              </>
            ) : (
              <>
                <IconLogin2 className="w-7 h-7 mr-2" stroke={2.5} />
                ¡Entrar a la Academia!
              </>
            )}
          </Button>
        </form>
      </Card>

      <div className="mt-8 text-center bg-white/80 backdrop-blur-sm px-6 py-4 rounded-3xl border-4 border-white shadow-[0_4px_20px_rgba(14,165,233,0.1)] inline-block mx-auto w-full">
        <p className="text-slate-600 font-bold flex flex-col sm:flex-row items-center justify-center gap-2">
          ¿Aún no tienes tu pase?
          <Link
            to="/register"
            className="text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1 font-black bg-amber-50 px-3 py-1.5 rounded-xl border-2 border-amber-200 hover:border-amber-300 focus-visible:ring-4 focus-visible:ring-amber-200 outline-none"
            onClick={handleRegisterClick}
          >
            <IconUserPlus className="w-5 h-5" stroke={2.5} />
            Crear cuenta
          </Link>
        </p>
      </div>
    </>
  );
}
