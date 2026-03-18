import { IconAxisX, IconCheck } from '@tabler/icons-react';

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
  const answered = selectedId !== null;

  const getOptionStyles = (opt: { id: string; isCorrect?: boolean }) => {
    if (!answered) {
      return 'border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50 hover:shadow-md active:scale-95 text-slate-700';
    }
    if (opt.id === selectedId) {
      return isCorrect
        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm scale-[1.02]'
        : 'border-rose-500 bg-rose-50 text-rose-900 shadow-sm scale-[1.02]';
    }
    if (opt.isCorrect && isCorrect === false) {
      return 'border-emerald-400 bg-emerald-50/50 text-emerald-800 opacity-90';
    }
    return 'border-slate-100 bg-slate-50/50 text-slate-400 opacity-50 scale-95';
  };

  const getOptionLetterStyles = (opt: { id: string; isCorrect?: boolean }) => {
    if (!answered)
      return 'bg-slate-100 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-600';
    if (opt.id === selectedId) {
      return isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white';
    }
    if (opt.isCorrect && isCorrect === false) return 'bg-emerald-400 text-white';
    return 'bg-slate-100 text-slate-400';
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 gap-6 w-full max-w-2xl mx-auto h-full justify-center">
      <div className="bg-gradient-to-br from-amber-50 to-white rounded-3xl border border-amber-100 p-6 sm:p-8 shadow-sm">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 bg-amber-100/50 px-3 py-1 rounded-full">
          <span>🎯</span> Tu turno
        </span>
        <p className="text-xl sm:text-2xl font-bold text-slate-800 leading-snug">{question}</p>
      </div>

      <div className="space-y-3">
        {options.map((opt, i) => (
          <button
            key={opt.id}
            onClick={() => !answered && !isProcessing && onAnswer(opt.text, opt.id)}
            disabled={answered || isProcessing}
            className={`group w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 text-left font-semibold transition-all duration-300 ${getOptionStyles(opt)}`}
          >
            <span
              className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-base transition-colors ${getOptionLetterStyles(opt)}`}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1 text-lg">{opt.text}</span>

            {answered && opt.id === selectedId ? (
              <span className="animate-fade-in shrink-0">
                {isCorrect ? (
                  <IconCheck className="w-8 h-8 text-emerald-500" />
                ) : (
                  <IconAxisX className="w-8 h-8 text-rose-500" />
                )}
              </span>
            ) : null}
            {answered && isCorrect === false && opt.isCorrect && opt.id !== selectedId ? (
              <span className="animate-fade-in shrink-0">
                <IconCheck className="w-8 h-8 text-emerald-400 opacity-80" />
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="h-8 flex justify-center items-center">
        {isProcessing ? <Spinner size="sm" className="text-sky-500" /> : null}
      </div>
    </div>
  );
}
