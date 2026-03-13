import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';

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
    } catch {}
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sky-50 p-6 font-sans text-slate-800">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🛸</div>
          <h1 className="text-3xl font-black text-sky-900">Pixel Mentor</h1>
        </div>

        <div className="bg-white border-2 border-sky-100 rounded-3xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div className="p-4 bg-rose-50 border-2 border-rose-100 text-rose-600 font-bold text-center rounded-2xl">
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="block text-sm font-bold text-slate-600 mb-2 pl-2">
                Tu correo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-medium focus:border-sky-400 focus:bg-white focus:outline-none transition-colors"
                placeholder="yo@correo.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-bold text-slate-600 mb-2 pl-2"
              >
                Tu contraseña secreta
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-medium focus:border-sky-400 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 py-4 bg-sky-500 text-white text-lg font-black rounded-2xl hover:bg-sky-600 hover:-translate-y-1 transform transition-all disabled:opacity-50 shadow-md"
            >
              {isLoading ? 'Entrando...' : '¡A jugar!'}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-base font-bold text-slate-500">
          ¿Eres nuevo?{' '}
          <Link to="/register" className="text-sky-500 hover:text-sky-600">
            Crea tu personaje
          </Link>
        </p>
      </div>
    </div>
  );
}
