import { IconScale } from '@tabler/icons-react';

import { useAudio } from '@/contexts/AudioContext';
import { cn } from '@/utils/cn';

/**
 * Renderer for the `true_false` activity format (Fase 1).
 * Shows the assertion with two big choices. Grading happens server-side.
 */
export function TrueFalseActivityPanel({
  question,
  onConfirm,
  isProcessing,
}: {
  question: string;
  onConfirm: (payload: { format: 'true_false'; value: boolean }, label: string) => void;
  isProcessing: boolean;
}) {
  const { playSelect, playHover } = useAudio();

  return (
    <div className="flex-1 flex flex-col p-6 sm:p-10 gap-8 w-full h-full justify-center overflow-y-auto custom-scrollbar animate-bounce-in">
      <div className="bg-amber-50 rounded-[2.5rem] border-4 border-amber-300 shadow-[0_8px_0_0_#fcd34d] p-8 shrink-0">
        <span className="inline-flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-wider mb-4 bg-amber-200/50 px-4 py-2 rounded-full border-2 border-amber-300">
          <IconScale className="w-5 h-5" stroke={2.5} /> ¿Verdadero o falso?
        </span>
        <p className="text-2xl sm:text-3xl font-black text-amber-950 leading-snug">{question}</p>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-2">
        {[
          {
            value: true,
            label: 'Verdadero',
            classes:
              'border-emerald-500 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-600 text-emerald-900 shadow-[0_8px_0_0_#059669] hover:shadow-[0_10px_0_0_#047857] focus-visible:ring-emerald-200',
          },
          {
            value: false,
            label: 'Falso',
            classes:
              'border-rose-500 bg-rose-50 hover:bg-rose-100 hover:border-rose-600 text-rose-900 shadow-[0_8px_0_0_#e11d48] hover:shadow-[0_10px_0_0_#be123c] focus-visible:ring-rose-200',
          },
        ].map((choice) => (
          <button
            key={String(choice.value)}
            onClick={() => {
              playSelect();
              onConfirm({ format: 'true_false', value: choice.value }, choice.label);
            }}
            onMouseEnter={() => playHover()}
            disabled={isProcessing}
            className={cn(
              'py-14 rounded-[2rem] text-3xl font-black border-4 transition-all duration-200 outline-none focus-visible:ring-4',
              choice.classes,
              isProcessing && 'opacity-60 cursor-wait',
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}
