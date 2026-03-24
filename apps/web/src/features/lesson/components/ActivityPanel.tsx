import { IconCheck, IconX, IconTargetArrow, IconHourglassHigh } from '@tabler/icons-react';

import { useAudio } from '@/contexts/AudioContext';
import { Spinner } from '@/components/ui';

export function ActivityPanel({
  question,
  options,
  onAnswer,
  isProcessing,
  selectedId,
  isCorrect,
}: {
  question: string;
  options: { id: string; text: string; isCorrect?: boolean }[];
  onAnswer: (text: string, id: string) => void;
  isProcessing: boolean;
  selectedId: string | null;
  isCorrect: boolean | null;
}) {
  const { playSelect, playHover } = useAudio();
  const answered = selectedId !== null;

  const getOptionStyle = (opt: { id: string; isCorrect?: boolean }) => {
    if (!answered) {
      return 'border-4 border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50 hover:-translate-y-1 shadow-[0_6px_0_0_#e2e8f0] hover:shadow-[0_8px_0_0_#fcd34d] active:translate-y-1 active:shadow-none text-slate-700 cursor-pointer';
    }
    if (opt.id === selectedId) {
      return isCorrect
        ? 'border-4 border-emerald-500 bg-emerald-100 text-emerald-900 shadow-none translate-y-1'
        : 'border-4 border-rose-500 bg-rose-100 text-rose-900 shadow-none translate-y-1';
    }
    if (opt.isCorrect && isCorrect === false) {
      return 'border-4 border-emerald-400 bg-emerald-50 text-emerald-800 opacity-90 shadow-none translate-y-1';
    }
    return 'border-4 border-slate-100 bg-slate-50 text-slate-400 opacity-50 shadow-none translate-y-1';
  };

  const getOptionLetterStyle = (opt: { id: string; isCorrect?: boolean }) => {
    if (!answered)
      return 'bg-slate-100 text-slate-500 group-hover:bg-amber-400 group-hover:text-white border-4 border-slate-200 group-hover:border-amber-500 shadow-sm';
    if (opt.id === selectedId)
      return isCorrect
        ? 'bg-emerald-500 text-white border-4 border-emerald-600'
        : 'bg-rose-500 text-white border-4 border-rose-600';
    if (opt.isCorrect && isCorrect === false)
      return 'bg-emerald-400 text-white border-4 border-emerald-500';
    return 'bg-slate-100 text-slate-400 border-4 border-slate-200';
  };

  return (
    <div className="flex-1 flex flex-col p-6 sm:p-10 gap-6 w-full h-full justify-center overflow-y-auto custom-scrollbar animate-bounce-in">
      <div className="bg-amber-50 rounded-[2.5rem] border-4 border-amber-300 shadow-[0_8px_0_0_#fcd34d] p-8 shrink-0">
        <span className="inline-flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-wider mb-4 bg-amber-200/50 px-4 py-2 rounded-full border-2 border-amber-300">
          <IconTargetArrow className="w-5 h-5" stroke={2.5} /> ¡Tu turno!
        </span>
        <p className="text-2xl sm:text-3xl font-black text-amber-950 leading-snug">{question}</p>
      </div>

      <div className="space-y-5 mt-2">
        {options.map((opt, i) => (
          <button
            key={opt.id}
            onClick={() => {
              if (!answered && !isProcessing) {
                playSelect();
                onAnswer(opt.text, opt.id);
              }
            }}
            onMouseEnter={() => !answered && playHover()}
            disabled={answered || isProcessing}
            className={`w-full flex items-center gap-5 p-6 rounded-[2rem] text-left font-bold transition-all duration-200 group outline-none ${getOptionStyle(opt)}`}
          >
            <span
              className={`w-14 h-14 flex items-center justify-center rounded-2xl text-2xl font-black transition-colors shrink-0 ${getOptionLetterStyle(opt)}`}
            >
              {String.fromCharCode(65 + i)}
            </span>

            <span className="flex-1 text-xl sm:text-2xl">{opt.text}</span>

            {answered && opt.id === selectedId ? (
              <span className="animate-bounce-in shrink-0 bg-white rounded-full p-2 shadow-sm border-4 border-slate-200">
                {isCorrect ? (
                  <IconCheck className="w-10 h-10 text-emerald-500" stroke={4} />
                ) : (
                  <IconX className="w-10 h-10 text-rose-500" stroke={4} />
                )}
              </span>
            ) : null}
            {answered && isCorrect === false && opt.isCorrect && opt.id !== selectedId ? (
              <span className="animate-bounce-in shrink-0 bg-white rounded-full p-2 shadow-sm border-4 border-slate-200">
                <IconCheck className="w-10 h-10 text-emerald-400 opacity-80" stroke={4} />
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="h-12 flex justify-center items-center mt-2 shrink-0">
        {isProcessing ? (
          <div className="flex items-center gap-3 text-sky-600 font-black bg-sky-100 px-6 py-3 rounded-2xl border-4 border-sky-200 shadow-[0_4px_0_0_#bae6fd]">
            <IconHourglassHigh className="w-6 h-6 animate-pulse" stroke={2.5} />
            <Spinner size="sm" />
            <span className="uppercase tracking-wider text-sm">Procesando</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
