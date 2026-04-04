import { useEffect } from 'react';
import { IconStarFilled, IconAlertTriangleFilled, IconBolt } from '@tabler/icons-react';

import { useAudio } from '@/contexts/AudioContext';
import { SpriteAudioEvent } from '@/audio/types/audio-events';
import { Spinner } from '@/components/ui';
import { logger } from '@/utils/logger';

interface FeedbackPanelProps {
  fb: { isCorrect: boolean; message: string; encouragement?: string; xpAwarded?: number };
  nextLessonText?: string;
  isStreaming?: boolean;
}

export function FeedbackPanel({ fb, nextLessonText, isStreaming }: FeedbackPanelProps) {
  const { playSprite } = useAudio();

  logger.log('[FeedbackPanel] Render:', {
    nextLessonTextLength: nextLessonText?.length ?? 0,
    fbMessage: fb.message,
    isStreaming,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      playSprite(SpriteAudioEvent.ActivityStart);
    }, 100);
    return () => clearTimeout(timer);
  }, [playSprite]);

  useEffect(() => {
    if (fb.isCorrect) {
      const timeout = setTimeout(() => {
        playSprite(SpriteAudioEvent.AnswerCorrect);
      }, 150);
      return () => clearTimeout(timeout);
    }
    // No sound for incorrect answers (positive-only policy)
  }, [fb.isCorrect, playSprite]);

  return (
    <div className="flex-1 flex flex-col items-center p-4 text-center gap-6 w-full h-full animate-bounce-in">
      <div
        className={`relative w-28 h-28 rounded-full flex items-center justify-center border-[9px] ${
          fb.isCorrect
            ? 'bg-emerald-100 border-emerald-300 shadow-[0_12px_0_0_#6ee7b7]'
            : 'bg-amber-100 border-amber-300 shadow-[0_12px_0_0_#fcd34d]'
        }`}
      >
        <div className="absolute inset-0 rounded-full animate-ping opacity-30 bg-inherit" />
        {fb.isCorrect ? (
          <IconStarFilled className="w-18 h-18 text-emerald-500 animate-pulse" />
        ) : (
          <IconAlertTriangleFilled className="w-18 h-18 text-amber-500 animate-pulse" />
        )}
      </div>

      <div className="max-w-xl w-full space-y-6">
        <h3
          className={`text-5xl sm:text-6xl font-black tracking-tight ${fb.isCorrect ? 'text-emerald-600' : 'text-amber-600'}`}
        >
          {fb.isCorrect ? '¡Excelente!' : '¡Buen intento!'}
        </h3>

        <div className="bg-white border-4 border-slate-200 rounded-[2.5rem] p-8 shadow-[0_8px_0_0_#e2e8f0]">
          <p className="text-2xl text-slate-800 font-bold leading-relaxed">{fb.message}</p>
          {fb.encouragement ? (
            <p className="text-xl font-black text-sky-500 mt-6">{fb.encouragement}</p>
          ) : null}
          {fb.isCorrect && fb.xpAwarded ? (
            <div className="mt-6 inline-flex items-center gap-2 bg-amber-50 border-4 border-amber-200 shadow-[0_4px_0_0_#fcd34d] px-5 py-3 rounded-2xl animate-bounce-in">
              <IconBolt className="w-6 h-6 text-amber-500" stroke={2.5} />
              <span className="text-2xl font-black text-amber-600">+{fb.xpAwarded} XP</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Show next lesson content if streaming */}
      {nextLessonText ? (
        <div className="max-w-xl w-full bg-slate-50 border-4 border-slate-200 rounded-[2.5rem] p-6 shadow-[0_8px_0_0_#e2e8f0]">
          <h4 className="text-lg font-bold text-sky-600 mb-3 flex items-center justify-center gap-2">
            {isStreaming ? (
              <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
            ) : null}
            Continuando...
          </h4>
          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{nextLessonText}</p>
        </div>
      ) : null}

      <div className="mt-6 flex items-center gap-3 bg-slate-100 border-4 border-slate-200 px-6 py-4 rounded-2xl shadow-inner">
        <Spinner size="sm" className="text-slate-400" />
        <span className="text-sm font-black text-slate-500 uppercase tracking-widest">
          {isStreaming ? 'Generando...' : 'Continuando...'}
        </span>
      </div>
    </div>
  );
}
