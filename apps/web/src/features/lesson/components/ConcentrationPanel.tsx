import { useEffect, useRef } from 'react';
import { IconRepeat, IconPlayerPlayFilled, IconAlertTriangle } from '@tabler/icons-react';
import { Spinner } from '@/components/ui';
import { cn } from '@/utils/cn';

interface ConcentrationPanelProps {
  words: string[];
  currentWordIndex: number;
  isSynced: boolean;
  isSpeaking: boolean;
  isAttemptingSync?: boolean;
  syncError?: boolean;
  onRepeat: () => void;
}

export function ConcentrationPanel({
  words,
  currentWordIndex,
  isSynced,
  isSpeaking,
  onRepeat,
  isAttemptingSync = false,
  syncError = false,
}: ConcentrationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Show all text when not synced (sync failed or not attempted yet)
  // Only use karaoke effect (incremental + highlight) when isSynced is true
  const showAllContent = !isSynced;
  const visibleCount = showAllContent ? words.length : currentWordIndex;
  const activeIndex = currentWordIndex - 1;

  useEffect(() => {
    if (currentWordIndex <= 0 || !scrollRef.current) return;

    const activeMarks = scrollRef.current.querySelectorAll('mark');
    const activeMark = Array.from(activeMarks).find((mark) => {
      const idx = mark.getAttribute('data-word-index');
      return idx && parseInt(idx, 10) === activeIndex;
    });

    if (activeMark) {
      (activeMark as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentWordIndex, activeIndex]);

  const showSyncIndicator = !isSynced && visibleCount > 0;
  const showError = syncError && showSyncIndicator;

  return (
    <div className="flex-1 flex flex-col items-center p-6 sm:p-8 gap-6 w-full h-full min-h-0 animate-bounce-in">
      {showSyncIndicator ? (
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full border-2 text-sm font-bold transition-all',
            showError
              ? 'bg-rose-50 border-rose-300 text-rose-600'
              : 'bg-sky-50 border-sky-300 text-sky-600',
          )}
        >
          {isAttemptingSync ? (
            <>
              <Spinner size="sm" className="text-sky-500" />
              <span>Sincronizando...</span>
            </>
          ) : showError ? (
            <>
              <IconAlertTriangle className="w-4 h-4" />
              <span>Recuperando...</span>
            </>
          ) : isSpeaking ? (
            <>
              <IconPlayerPlayFilled className="w-4 h-4 animate-pulse" />
              <span>Reproduciendo</span>
            </>
          ) : null}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="bg-white rounded-[2.5rem] border-4 border-sky-100 shadow-[0_8px_0_0_#e0f2fe] p-6 sm:p-10 w-full flex-1 min-h-0 max-h-[40vh] sm:max-h-[50vh] lg:max-h-[55vh] overflow-y-auto custom-scrollbar"
      >
        <div className="text-2xl sm:text-3xl leading-relaxed tracking-tight font-bold">
          {words.slice(0, visibleCount).map((word, idx) => (
            <mark
              key={`${word}-${idx}`}
              data-word-index={idx}
              className={cn(
                'bg-transparent transition-colors duration-200',
                idx === activeIndex && 'bg-amber-200 text-amber-900 rounded-xl px-2 py-0.5 shadow-sm',
              )}
            >
              {word}{' '}
            </mark>
          ))}
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
        ) : words.length > 0 ? (
          <button
            onClick={onRepeat}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-slate-50 text-slate-600 font-black text-lg rounded-[1.5rem] border-4 border-slate-200 shadow-[0_6px_0_0_#e2e8f0] hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 hover:shadow-[0_6px_0_0_#7dd3fc] active:translate-y-1 active:shadow-none transition-all cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
          >
            <IconRepeat className="w-6 h-6" stroke={3} />
            Repetir
          </button>
        ) : null}
      </div>
    </div>
  );
}
