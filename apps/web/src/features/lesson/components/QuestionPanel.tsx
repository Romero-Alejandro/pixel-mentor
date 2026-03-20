import { IconSend, IconMessageCircleQuestion } from '@tabler/icons-react';
import { useState } from 'react';

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

  const submit = () => {
    const t = val.trim();
    if (!t || isProcessing) return;
    onAnswer(t);
    setVal('');
  };

  return (
    <div className="flex-1 flex flex-col p-6 sm:p-10 gap-6 w-full h-full justify-center">
      <div className="bg-sky-50 rounded-[2rem] border-4 border-sky-200 shadow-[0_6px_0_0_#bae6fd] p-8">
        <span className="inline-flex items-center gap-2 text-xs font-black text-sky-700 uppercase tracking-wider mb-4 bg-sky-200/50 px-4 py-2 rounded-full border-2 border-sky-300">
          <IconMessageCircleQuestion className="w-5 h-5" stroke={2.5} /> Pregunta Abierta
        </span>
        <p className="text-2xl sm:text-3xl font-black text-slate-800 leading-snug">{question}</p>
      </div>

      <div className="flex flex-col gap-4 bg-white p-2 rounded-[2rem] border-4 border-slate-200 shadow-[0_6px_0_0_#e2e8f0] focus-within:border-sky-300 focus-within:shadow-[0_6px_0_0_#7dd3fc] transition-all">
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Escribe aquí tu respuesta..."
          disabled={isProcessing}
          rows={4}
          className="w-full p-4 bg-transparent border-none text-slate-800 font-bold text-lg placeholder:text-slate-300 placeholder:font-medium focus:ring-0 resize-none disabled:opacity-50 outline-none"
        />
        <div className="flex justify-end p-2">
          <button
            onClick={submit}
            disabled={!val.trim() || isProcessing}
            className="flex items-center gap-2 px-8 py-3 bg-sky-500 text-white text-lg font-black rounded-2xl border-4 border-sky-600 shadow-[0_4px_0_0_#0284c7] hover:bg-sky-400 hover:shadow-[0_6px_0_0_#0284c7] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:transform-none disabled:shadow-none transition-all cursor-pointer"
          >
            {isProcessing ? (
              <Spinner size="sm" />
            ) : (
              <>
                Enviar <IconSend className="w-5 h-5" stroke={2.5} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
