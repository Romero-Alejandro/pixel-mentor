import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (password !== confirmPassword) {
      setValidationError('Las claves de acceso no coinciden.');
      return;
    }

    if (password.length < 6) {
      setValidationError('La clave requiere un mínimo de 6 caracteres.');
      return;
    }

    try {
      await register(email, password, name, 'STUDENT');
      navigate('/dashboard');
    } catch {}
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans text-slate-900">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex flex-col items-center">
          <div className="w-8 h-8 bg-slate-900 rounded-sm mb-4"></div>
          <h1 className="text-xl font-semibold tracking-tight">Pixel Mentor</h1>
          <p className="text-sm text-slate-500 mt-1">Alta de nuevo operador</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error || validationError ? (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
                {error || validationError}
              </div>
            ) : null}

            <div>
              <label htmlFor="name" className="block text-xs font-medium text-slate-700 mb-1.5">
                Designación (Nombre)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:border-slate-400 focus:outline-none transition-colors"
                placeholder="Operador Alfa"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1.5">
                Identificador (Email)
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:border-slate-400 focus:outline-none transition-colors"
                placeholder="alfa@sistema.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-700 mb-1.5">
                Clave de acceso
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:border-slate-400 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Confirmar clave
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:border-slate-400 focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 focus:outline-none transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Procesando...' : 'Registrar'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          ¿Registro existente?{' '}
          <Link to="/login" className="text-slate-900 font-medium hover:underline">
            Autenticarse
          </Link>
        </p>
      </div>
    </div>
  );
}
