import { IconRepeat } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';

import { Spinner } from '@/components/ui';

export function ConcentrationPanel({
  text,
  visibleText,
  isSpeaking,
  isSynced,
  onRepeat,
}: {
  text: string;
  visibleText?: string;
  isSpeaking: boolean;
  isSynced?: boolean;
  onRepeat: () => void;
}) {
  const displayText = visibleText ?? text;
  const showCursor = isSpeaking && !isSynced;
  const textContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textContainerRef.current && displayText) {
      textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
    }
  }, [displayText]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 gap-6 w-full h-full">
      <div
        ref={textContainerRef}
        className="bg-white rounded-3xl border border-sky-100 shadow-md p-6 sm:p-8 w-full max-w-2xl overflow-y-auto max-h-[50vh] transition-all"
      >
        <p className="text-xl sm:text-2xl text-slate-700 leading-relaxed font-medium">
          {displayText || 'Preparando contenido...'}
          {showCursor ? (
            <span className="inline-block w-1.5 h-6 bg-sky-500 ml-1 rounded-full animate-pulse align-middle" />
          ) : null}
        </p>
      </div>

      <div className="h-10 flex items-center justify-center">
        {isSpeaking ? (
          <div className="flex items-center gap-3 bg-sky-50 px-5 py-2 rounded-full border border-sky-100">
            <span className="flex gap-1">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
            <span className="text-sm font-bold text-sky-600 tracking-wide uppercase">
              Escuchando
            </span>
          </div>
        ) : text ? (
          <button
            onClick={onRepeat}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-full transition-all active:scale-95"
          >
            <IconRepeat className="w-5 h-5" />
            Repetir explicación
          </button>
        ) : (
          <Spinner size="sm" className="text-sky-400" />
        )}
      </div>
    </div>
  );
}
