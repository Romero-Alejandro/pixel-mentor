import { useState } from 'react';
import { IconArrowsSort, IconListNumbers } from '@tabler/icons-react';

import { useAudio } from '@/contexts/AudioContext';
import { cn } from '@/utils/cn';

/**
 * Renderer for the `ordering` activity format (Fase 1).
 * Mobile-friendly tap-to-swap: tap an item, tap another to swap positions.
 * Items arrive pre-shuffled from useLessonAutoAdvance; the correct order
 * never reaches the client (grading happens server-side).
 */
export function OrderingActivityPanel({
  question,
  items,
  onConfirm,
  isProcessing,
}: {
  question: string;
  items: Array<{ id: string; text: string }>;
  onConfirm: (payload: { format: 'ordering'; itemIds: string[] }, label: string) => void;
  isProcessing: boolean;
}) {
  const { playSelect, playHover } = useAudio();
  const [ordered, setOrdered] = useState<Array<{ id: string; text: string }>>(items);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  function handleTap(index: number): void {
    if (isProcessing) return;
    if (pickedIndex === null) {
      playSelect();
      setPickedIndex(index);
      return;
    }
    if (pickedIndex === index) {
      setPickedIndex(null);
      return;
    }
    playSelect();
    setOrdered((prev) => {
      const next = [...prev];
      [next[pickedIndex], next[index]] = [next[index], next[pickedIndex]];
      return next;
    });
    setPickedIndex(null);
  }

  const label = ordered.map((it) => it.text).join(' → ');

  return (
    <div className="flex-1 flex flex-col p-6 sm:p-10 gap-6 w-full h-full justify-center overflow-y-auto custom-scrollbar animate-bounce-in">
      <div className="bg-amber-50 rounded-[2.5rem] border-4 border-amber-300 shadow-[0_8px_0_0_#fcd34d] p-8 shrink-0">
        <span className="inline-flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-wider mb-4 bg-amber-200/50 px-4 py-2 rounded-full border-2 border-amber-300">
          <IconListNumbers className="w-5 h-5" stroke={2.5} /> Ordená los pasos — tocá dos para
          intercambiarlos
        </span>
        <p className="text-2xl sm:text-3xl font-black text-amber-950 leading-snug">{question}</p>
      </div>

      <div className="space-y-4 mt-2 flex-1">
        {ordered.map((item, index) => (
          <button
            key={item.id}
            onClick={() => handleTap(index)}
            onMouseEnter={() => playHover()}
            disabled={isProcessing}
            className={cn(
              'w-full flex items-center gap-5 p-5 rounded-[2rem] text-left border-4 font-bold transition-all duration-200 outline-none',
              pickedIndex === index
                ? 'border-amber-500 bg-amber-100 text-amber-950 shadow-[0_4px_0_0_#d97706] translate-y-1 scale-[1.01]'
                : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50 text-slate-700 shadow-[0_6px_0_0_#e2e8f0] hover:shadow-[0_8px_0_0_#fcd34d] cursor-pointer focus-visible:ring-4 focus-visible:ring-amber-200',
            )}
          >
            <span
              className={cn(
                'w-12 h-12 border-4 flex items-center justify-center rounded-2xl text-xl font-black shrink-0',
                pickedIndex === index
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-slate-100 text-slate-500 border-slate-200',
              )}
            >
              {index + 1}
            </span>
            <span className="flex-1 text-lg sm:text-xl">{item.text}</span>
            <IconArrowsSort className="w-5 h-5 text-slate-300 shrink-0" stroke={2.5} />
          </button>
        ))}
      </div>

      <button
        onClick={() =>
          onConfirm({ format: 'ordering', itemIds: ordered.map((it) => it.id) }, label)
        }
        disabled={isProcessing}
        className="w-full py-4 rounded-[1.75rem] text-xl font-black border-4 border-emerald-500 bg-emerald-400 text-emerald-950 shadow-[0_6px_0_0_#059669] hover:bg-emerald-300 active:translate-y-1 active:shadow-none transition-all duration-200 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
      >
        Confirmar orden
      </button>
    </div>
  );
}
