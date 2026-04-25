import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconWand, IconArrowLeft, IconAlertCircleFilled } from '@tabler/icons-react';

import { useAuth } from '../hooks/useAuth';
import { Button, Input, Card } from '@/components/ui';
import { useAudio } from '@/contexts/AudioContext';

export function RegisterForm() {
  const navigate = useNavigate();
  const { playFocus, playClick, playClickSecondary } = useAudio();
  const { register, error, clearError, isRegistering } = useAuth();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [validationError, setValidationError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    clearError();
    setValidationError('');

    if (password !== confirmPassword) {
      setValidationError('¡Ups! Las contraseñas secretas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setValidationError('Tu contraseña secreta debe tener al menos 6 caracteres.');
      return;
    }

    if (username) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(username)) {
        setUsernameError(
          'Tu apodo solo puede tener letras, números y guiones bajos (sin espacios).',
        );
        return;
      }
    }

    try {
      await register({ email, password, name, username });
      navigate('/dashboard');
    } catch {}
  };

  const combinedError = error || validationError || usernameError;

  return (
    <div className="w-full max-w-md mx-auto relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <Link
        to="/login"
        onClick={() => playClickSecondary()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border-4 border-white text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-2xl font-bold transition-all shadow-sm mb-6 outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
      >
        <IconArrowLeft className="w-5 h-5" stroke={3} />
        <span>Volver</span>
      </Link>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-400 rounded-[2rem] shadow-[0_6px_0_0_#059669] border-4 border-white mb-4 -rotate-3 hover:rotate-0 transition-transform duration-300">
          <IconWand className="w-10 h-10 text-white drop-shadow-md" stroke={2.5} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-sky-900 tracking-tight drop-shadow-sm">
          Crea tu Héroe
        </h1>
        <p className="text-sky-600 font-bold mt-1 text-lg">Únete a la academia mágica</p>
      </div>

      <Card className="bg-white/95 backdrop-blur-md rounded-[2.5rem] border-4 border-white shadow-[0_12px_40px_rgba(14,165,233,0.15)] p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {combinedError ? (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border-4 border-rose-200 text-rose-700 text-sm font-bold rounded-2xl animate-bounce-in">
              <IconAlertCircleFilled className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{combinedError}</span>
            </div>
          ) : null}

          <div className="space-y-4">
            <Input
              label="Nombre completo"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={playFocus}
              required
              placeholder="¿Cómo te llamas?"
              autoComplete="name"
              className="border-4 border-slate-200 rounded-2xl font-bold px-4 py-3 bg-slate-50 focus:bg-white focus:border-sky-400 transition-colors shadow-inner"
            />

            <Input
              label="Tu apodo (Opcional)"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase());
                setUsernameError('');
              }}
              onFocus={playFocus}
              placeholder="Ej: super_mario"
              autoComplete="username"
              className="border-4 border-slate-200 rounded-2xl font-bold px-4 py-3 bg-slate-50 focus:bg-white focus:border-sky-400 transition-colors shadow-inner"
            />

            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={playFocus}
              required
              placeholder="tu@email.com"
              autoComplete="email"
              className="border-4 border-slate-200 rounded-2xl font-bold px-4 py-3 bg-slate-50 focus:bg-white focus:border-sky-400 transition-colors shadow-inner"
            />

            <Input
              label="Contraseña secreta"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={playFocus}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              className="border-4 border-slate-200 rounded-2xl font-bold px-4 py-3 bg-slate-50 focus:bg-white focus:border-sky-400 transition-colors shadow-inner"
            />

            <Input
              label="Confirma tu contraseña"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={playFocus}
              required
              placeholder="Repite tu clave"
              autoComplete="new-password"
              className="border-4 border-slate-200 rounded-2xl font-bold px-4 py-3 bg-slate-50 focus:bg-white focus:border-sky-400 transition-colors shadow-inner"
            />
          </div>

          <Button
            type="submit"
            disabled={isRegistering}
            className="w-full mt-6 text-xl bg-emerald-500 hover:bg-emerald-400 border-4 border-emerald-600 shadow-[0_6px_0_0_#059669] hover:-translate-y-1 active:translate-y-[6px] active:border-b-0 active:shadow-none hover:shadow-[0_8px_0_0_#059669] transition-all rounded-[1.5rem] py-4 font-black flex items-center justify-center focus-visible:ring-4 focus-visible:ring-emerald-200 outline-none"
          >
            {isRegistering ? 'Forjando pase...' : '¡Crear Personaje!'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
