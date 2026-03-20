import { useEffect, useRef } from 'react';
import { IconRepeat, IconPlayerPlayFilled } from '@tabler/icons-react';

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

  const transitionWords = transitionText.trim().split(/\s+/).filter(Boolean);
  const contentWords = contentText.trim().split(/\s+/).filter(Boolean);
  const closureWords = closureText.trim().split(/\s+/).filter(Boolean);

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
    <div className="flex-1 flex flex-col items-center p-6 sm:p-8 gap-6 w-full h-full min-h-0 animate-bounce-in">
      <div
        ref={scrollRef}
        className="bg-white rounded-[2.5rem] border-4 border-sky-100 shadow-[0_8px_0_0_#e0f2fe] p-6 sm:p-10 w-full flex-1 min-h-0 max-h-[40vh] sm:max-h-[50vh] lg:max-h-[55vh] overflow-y-auto scroll-smooth custom-scrollbar"
      >
        <div className="text-2xl sm:text-3xl leading-relaxed tracking-tight">
          <TextSection
            words={transitionWords}
            visibleCount={visibleT}
            activeIndex={activeT}
            containerClassName="block mb-6 text-sky-600/80 font-bold"
            wordClassName="transition-colors duration-200"
            activeWordClassName="bg-sky-100 text-sky-800 rounded-xl px-2 py-0.5 shadow-sm"
          />

          <TextSection
            words={contentWords}
            visibleCount={visibleC}
            activeIndex={activeC}
            containerClassName="block mb-6 text-slate-800 font-bold"
            wordClassName="transition-colors duration-200"
            activeWordClassName="bg-amber-100 text-amber-900 rounded-xl px-2 py-0.5 shadow-sm"
          />

          <TextSection
            words={closureWords}
            visibleCount={visibleL}
            activeIndex={activeL}
            containerClassName="block text-emerald-600 font-black"
            wordClassName="transition-colors duration-200"
            activeWordClassName="bg-emerald-100 text-emerald-900 rounded-xl px-2 py-0.5 shadow-sm"
          />

          {!isSynced && (visibleT > 0 || visibleC > 0 || visibleL > 0) ? (
            <span className="inline-block w-4 h-4 ml-2 bg-sky-400 rounded-full animate-pulse" />
          ) : null}
        </div>
      </div>

      <div className="h-16 flex items-center justify-center shrink-0 w-full">
        {isSpeaking ? (
          <div className="flex items-center gap-3 bg-sky-50 px-8 py-4 rounded-[1.5rem] border-4 border-sky-200 shadow-[0_6px_0_0_#bae6fd]">
            <IconPlayerPlayFilled className="w-6 h-6 text-sky-500 animate-pulse" />
            <span className="text-sm font-black text-sky-700 uppercase tracking-widest">
              Escuchando
            </span>
          </div>
        ) : fullVoiceText ? (
          <button
            onClick={onRepeat}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-slate-50 text-slate-600 font-black text-lg rounded-[1.5rem] border-4 border-slate-200 shadow-[0_6px_0_0_#e2e8f0] hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 hover:shadow-[0_6px_0_0_#7dd3fc] active:translate-y-1 active:shadow-none transition-all cursor-pointer outline-none"
          >
            <IconRepeat className="w-6 h-6" stroke={3} />
            Repetir
          </button>
        ) : null}
      </div>
    </div>
  );
}
