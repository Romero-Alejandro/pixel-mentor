import { IconPlayerPlayFilled } from '@tabler/icons-react';

interface StartPanelProps {
  studentName: string;
  onStart: () => void;
  isProcessing: boolean;
}

export function StartPanel({ studentName, onStart, isProcessing }: StartPanelProps) {
  return (
    <div className="flex-1 flex flex-col items-center p-6 sm:p-10 gap-8 w-full h-full justify-center animate-bounce-in">
      <div className="text-center space-y-4">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-800">¡Hola, {studentName}! 👋</h2>
        <p className="text-xl text-slate-600 font-medium">
          ¿Estás listo para comenzar tu aventura de aprendizaje?
        </p>
      </div>

      <button
        onClick={onStart}
        disabled={isProcessing}
        className="flex items-center justify-center gap-3 px-12 py-5 bg-sky-500 text-white font-black text-xl rounded-[2rem] border-4 border-sky-600 shadow-[0_8px_0_0_#0284c7] hover:bg-sky-400 hover:shadow-[0_10px_0_0_#0284c7] hover:-translate-y-1 active:translate-y-2 active:shadow-none disabled:opacity-50 disabled:transform-none disabled:shadow-none transition-all cursor-pointer outline-none"
      >
        <IconPlayerPlayFilled className="w-8 h-8" stroke={2.5} />
        {isProcessing ? 'Comenzando...' : 'Comenzar'}
      </button>

      <p className="text-sm text-slate-400 font-medium text-center max-w-xs">
        Tu tutor te guiará paso a paso en esta lección interactiva.
      </p>
    </div>
  );
}
