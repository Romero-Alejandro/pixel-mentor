import { IconRepeat } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

export function CompletedPanel({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-8 w-full h-full animate-fade-in">
      <div className="relative w-40 h-40">
        <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20" />
        <div className="absolute inset-0 flex items-center justify-center text-8xl drop-shadow-xl hover:scale-110 transition-transform cursor-default z-10">
          🏆
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">¡Misión Cumplida!</h2>
        <p className="text-xl text-slate-500 font-medium">Has completado esta lección con éxito.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        <button
          onClick={onRestart}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-sky-500 text-white rounded-2xl font-bold text-lg hover:bg-sky-600 transition-all active:scale-95 shadow-lg shadow-sky-200"
        >
          <IconRepeat className="w-6 h-6" />
          Repetir Misión
        </button>
        <Link
          to="/dashboard"
          className="flex items-center justify-center px-8 py-4 bg-white text-slate-600 border-2 border-slate-200 rounded-2xl font-bold text-lg hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-95"
        >
          Volver al Inicio
        </Link>
      </div>
    </div>
  );
}
