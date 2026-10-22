import { useState } from 'react';
import { IconCheck, IconListCheck } from '@tabler/icons-react';

import { useAudio } from '@/contexts/AudioContext';
import { cn } from '@/utils/cn';

/**
 * Renderer for the `mcq_multi` activity format (Fase 1).
 * Student toggles every option that applies, then confirms. The correct
 * answer never reaches this component — grading/reveal happens server-side.
 */
export function MultiSelectActivityPanel({
  question,
  options,
  onConfirm,
  isProcessing,
}: {
  question: string;
  options: Array<{ id: string; text: string }>;
  onConfirm: (payload: { format: 'mcq_multi'; optionIds: string[] }, label: string) => void;
  isProcessing: boolean;
}) {
  const { playSelect, playHover } = useAudio();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string): void {
    if (isProcessing) return;
    playSelect();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = options.filter((o) => selected.has(o.id)).map((o) => o.id);
  const label = options
    .filter((o) => selected.has(o.id))
    .map((o) => o.text)
    .join(', ');

  return (
    <div className="flex-1 flex flex-col p-6 sm:p-10 gap-6 w-full h-full justify-center overflow-y-auto custom-scrollbar animate-bounce-in">
      <div className="bg-amber-50 rounded-[2.5rem] border-4 border-amber-300 shadow-[0_8px_0_0_#fcd34d] p-8 shrink-0">
        <span className="inline-flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-wider mb-4 bg-amber-200/50 px-4 py-2 rounded-full border-2 border-amber-300">
          <IconListCheck className="w-5 h-5" stroke={2.5} /> Seleccioná todas las que correspondan
        </span>
        <p className="text-2xl sm:text-3xl font-black text-amber-950 leading-snug">{question}</p>
      </div>

      <div className="space-y-4 mt-2 flex-1">
        {options.map((opt, i) => {
          const isSelected = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              onMouseEnter={() => playHover()}
              disabled={isProcessing}
              className={cn(
                'w-full flex items-center gap-5 p-5 rounded-[2rem] text-left border-4 font-bold transition-all duration-200 outline-none',
                isSelected
                  ? 'border-sky-500 bg-sky-100 text-sky-950 shadow-[0_4px_0_0_#0284c7] translate-y-1'
                  : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50 text-slate-700 shadow-[0_6px_0_0_#e2e8f0] hover:shadow-[0_8px_0_0_#bae6fd] cursor-pointer focus-visible:ring-4 focus-visible:ring-sky-200',
              )}
            >
              <span
                className={cn(
                  'w-12 h-12 border-4 flex items-center justify-center rounded-2xl text-xl font-black shrink-0 transition-colors',
                  isSelected
                    ? 'bg-sky-500 text-white border-sky-600'
                    : 'bg-slate-100 text-slate-500 border-slate-200',
                )}
              >
                {isSelected ? (
                  <IconCheck className="w-6 h-6" stroke={4} />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="flex-1 text-lg sm:text-xl">{opt.text}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onConfirm({ format: 'mcq_multi', optionIds: selectedIds }, label)}
        disabled={isProcessing || selected.size === 0}
        className={cn(
          'w-full py-4 rounded-[1.75rem] text-xl font-black border-4 transition-all duration-200 outline-none',
          selected.size === 0 || isProcessing
            ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'border-emerald-500 bg-emerald-400 text-emerald-950 shadow-[0_6px_0_0_#059669] hover:bg-emerald-300 active:translate-y-1 active:shadow-none cursor-pointer focus-visible:ring-4 focus-visible:ring-emerald-200',
        )}
      >
        Confirmar respuesta
      </button>
    </div>
  );
}
