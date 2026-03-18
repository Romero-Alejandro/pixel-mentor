import { IconSend } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import { Spinner } from '@/components/ui';

export function QuestionPanel({
  question,
  onAnswer,
  isProcessing,
}: {
  question: string;
  onAnswer: (t: string) => void;
  isProcessing: boolean;
}) {
  const [val, setVal] = useState('');

  const submit = useCallback(() => {
    const t = val.trim();
    if (!t || isProcessing) return;
    onAnswer(t);
    setVal('');
  }, [val, isProcessing, onAnswer]);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 gap-6 w-full max-w-2xl mx-auto h-full justify-center">
      <div className="bg-gradient-to-br from-sky-50 to-white rounded-3xl border border-sky-100 p-6 sm:p-8 shadow-sm">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-sky-600 uppercase tracking-wider mb-3 bg-sky-100/50 px-3 py-1 rounded-full">
          <span>💬</span> El tutor pregunta
        </span>
        <p className="text-xl sm:text-2xl font-bold text-slate-800 leading-snug">{question}</p>
      </div>

      <div className="flex flex-col gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Escribe aquí lo que piensas..."
          disabled={isProcessing}
          rows={3}
          className="w-full p-4 rounded-2xl bg-slate-50 border-none text-slate-800 text-lg placeholder:text-slate-400 focus:ring-4 focus:ring-sky-100 focus:bg-white resize-none transition-all disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={!val.trim() || isProcessing}
          className="self-end flex items-center gap-2 px-8 py-3.5 bg-sky-500 text-white text-lg font-bold rounded-2xl hover:bg-sky-600 disabled:opacity-50 disabled:hover:bg-sky-500 transition-all active:scale-95 shadow-md shadow-sky-200"
        >
          {isProcessing ? (
            <Spinner size="sm" />
          ) : (
            <>
              Enviar
              <IconSend className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
