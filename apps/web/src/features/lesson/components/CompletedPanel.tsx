import { IconRepeat, IconMap, IconTrophyFilled, IconStars } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

export function CompletedPanel({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-10 w-full h-full animate-bounce-in">
      <div className="relative w-56 h-56">
        <div className="absolute inset-0 bg-amber-300 rounded-full animate-ping opacity-40 blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-full shadow-[0_12px_0_0_#d97706] border-8 border-white flex items-center justify-center z-10 animate-float">
          <IconTrophyFilled className="w-28 h-28 text-white drop-shadow-md" />
          <IconStars className="absolute -top-6 -right-6 w-16 h-16 text-amber-500 animate-pulse" />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-5xl sm:text-6xl font-black text-slate-800 tracking-tight">
          ¡Misión Cumplida!
        </h2>
        <p className="text-2xl text-slate-500 font-bold">Has conquistado este desafío.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 mt-8 w-full max-w-xl">
        <button
          onClick={onRestart}
          className="flex-1 flex items-center justify-center gap-3 px-6 py-5 bg-white text-slate-600 font-black text-xl rounded-[2rem] border-4 border-slate-200 shadow-[0_8px_0_0_#e2e8f0] hover:bg-sky-50 hover:border-sky-300 hover:shadow-[0_8px_0_0_#7dd3fc] hover:text-sky-600 hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer outline-none"
        >
          <IconRepeat className="w-7 h-7" stroke={3} />
          Repetir
        </button>
        <Link to="/dashboard" className="flex-1 outline-none">
          <button className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-sky-500 text-white font-black text-xl rounded-[2rem] border-4 border-sky-600 shadow-[0_8px_0_0_#0284c7] hover:bg-sky-400 hover:shadow-[0_10px_0_0_#0284c7] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer outline-none">
            <IconMap className="w-7 h-7" stroke={3} />
            Volver al Mapa
          </button>
        </Link>
      </div>
    </div>
  );
}
