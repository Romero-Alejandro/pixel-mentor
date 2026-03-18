import { Spinner } from '@/components/ui';

export function FeedbackPanel({
  fb,
}: {
  fb: { isCorrect: boolean; message: string; encouragement?: string };
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6 w-full h-full animate-fade-in">
      <div
        className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-lg ${
          fb.isCorrect ? 'bg-emerald-500 shadow-emerald-200' : 'bg-amber-400 shadow-amber-200'
        }`}
      >
        <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-inherit" />
        <span className="text-6xl drop-shadow-md z-10">{fb.isCorrect ? '🌟' : '💪'}</span>
      </div>

      <div className="max-w-md space-y-3">
        <h3
          className={`text-3xl font-black ${fb.isCorrect ? 'text-emerald-600' : 'text-amber-600'}`}
        >
          {fb.isCorrect ? '¡Excelente!' : '¡Buen intento!'}
        </h3>
        <p className="text-xl text-slate-700 font-medium leading-relaxed">{fb.message}</p>
        {fb.encouragement ? (
          <p className="text-lg font-bold text-sky-500 mt-4">{fb.encouragement}</p>
        ) : null}
      </div>

      <div className="mt-8 flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
        <Spinner size="sm" className="text-slate-400" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Avanzando</p>
      </div>
    </div>
  );
}
