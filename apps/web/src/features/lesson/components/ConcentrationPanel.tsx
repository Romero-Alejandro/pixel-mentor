import { IconRepeat } from '@tabler/icons-react';
import { useMemo, useEffect, useRef } from 'react';

import { Spinner } from '@/components/ui';

interface TextSectionProps {
  words: string[];
  visibleCount: number;
  activeIndex: number;
  containerClassName: string;
  wordClassName: string;
  activeWordClassName: string;
}

function TextSection({
  words,
  visibleCount,
  activeIndex,
  containerClassName,
  wordClassName,
  activeWordClassName,
}: TextSectionProps) {
  if (visibleCount === 0) return null;

  return (
    <span className={containerClassName}>
      {words.slice(0, visibleCount).map((word, idx) => (
        <span
          key={`${word}-${idx}`}
          className={`${wordClassName} ${idx === activeIndex ? activeWordClassName : ''}`}
        >
          {word}{' '}
        </span>
      ))}
    </span>
  );
}

interface ConcentrationPanelProps {
  fullVoiceText: string;
  transitionText: string;
  contentText: string;
  closureText: string;
  currentWordIndex: number;
  isSynced: boolean;
  isSpeaking: boolean;
  onRepeat: () => void;
}

export function ConcentrationPanel({
  transitionText,
  contentText,
  closureText,
  currentWordIndex,
  isSynced,
  isSpeaking,
  onRepeat,
  fullVoiceText,
}: ConcentrationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const transitionWords = useMemo(
    () => transitionText.trim().split(/\s+/).filter(Boolean),
    [transitionText],
  );
  const contentWords = useMemo(
    () => contentText.trim().split(/\s+/).filter(Boolean),
    [contentText],
  );
  const closureWords = useMemo(
    () => closureText.trim().split(/\s+/).filter(Boolean),
    [closureText],
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentWordIndex]);

  const tLen = transitionWords.length;
  const cLen = contentWords.length;
  const lLen = closureWords.length;

  const visibleT = isSynced ? tLen : Math.min(currentWordIndex, tLen);
  const visibleC = isSynced ? cLen : Math.max(0, Math.min(currentWordIndex - tLen, cLen));
  const visibleL = isSynced ? lLen : Math.max(0, Math.min(currentWordIndex - tLen - cLen, lLen));

  const activeT = isSynced ? -1 : currentWordIndex - 1;
  const activeC = isSynced ? -1 : currentWordIndex - 1 - tLen;
  const activeL = isSynced ? -1 : currentWordIndex - 1 - tLen - cLen;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 gap-6 w-full h-full">
      <div
        ref={scrollRef}
        className="bg-white rounded-[2rem] border border-sky-100/60 shadow-xl shadow-sky-100/30 p-8 sm:p-10 w-full max-w-3xl overflow-y-auto max-h-[60vh] flex flex-col scroll-smooth"
      >
        <div className="text-2xl sm:text-3xl leading-relaxed tracking-tight">
          <TextSection
            words={transitionWords}
            visibleCount={visibleT}
            activeIndex={activeT}
            containerClassName="block mb-6 text-sky-600/80 italic font-medium"
            wordClassName="transition-colors duration-200"
            activeWordClassName="bg-sky-100 text-sky-800 rounded-md px-1 py-0.5"
          />

          <TextSection
            words={contentWords}
            visibleCount={visibleC}
            activeIndex={activeC}
            containerClassName="block mb-6 text-slate-800 font-semibold"
            wordClassName="transition-colors duration-200"
            activeWordClassName="bg-sky-100 text-sky-900 rounded-md px-1 py-0.5"
          />

          <TextSection
            words={closureWords}
            visibleCount={visibleL}
            activeIndex={activeL}
            containerClassName="block text-emerald-600 font-bold"
            wordClassName="transition-colors duration-200"
            activeWordClassName="bg-emerald-100 text-emerald-800 rounded-md px-1 py-0.5"
          />

          {!isSynced && (visibleT > 0 || visibleC > 0 || visibleL > 0) ? (
            <span className="inline-block w-2 h-2 ml-2 bg-sky-400 rounded-full animate-pulse" />
          ) : null}
        </div>
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
            <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">
              Escuchando
            </span>
          </div>
        ) : fullVoiceText ? (
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
