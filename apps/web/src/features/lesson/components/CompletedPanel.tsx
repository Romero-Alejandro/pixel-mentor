import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  IconRepeat,
  IconMap,
  IconTrophyFilled,
  IconStars,
  IconRefresh,
  IconArrowRight,
  IconTargetArrow,
  IconStar,
  IconCircleCheck,
  IconCircleX,
} from '@tabler/icons-react';

import { AccuracyTier, TIER_CONFIG } from '../constants/lesson.constants';

import { useAudio } from '@/contexts/AudioContext';
import { SpriteAudioEvent } from '@/audio/types/audio-events';

const COMPLETION_ITEM_STAGGER_DELAY_MS = 200;

export interface QuestionResult {
  question: string;
  isCorrect: boolean;
}

export interface AccuracyStats {
  correctFirstAttempts: number;
  correctLastAttempts: number;
  totalActivities: number;
  skippedActivities: number;
  accuracyPercent: number;
  allCorrectOnFirstAttempt: boolean;
  tier: AccuracyTier;
}

export interface CompletedPanelProps {
  onRestart: () => void;
  isRepeat?: boolean;
  xpEarned?: number;
  accuracy?: AccuracyStats;
  questionResults?: QuestionResult[];
}

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-bounce-in"
          style={{
            animationDelay: `${i * COMPLETION_ITEM_STAGGER_DELAY_MS}ms`,
            animationFillMode: 'both',
          }}
        >
          <IconStar
            className={`w-12 h-12 sm:w-14 sm:h-14 ${i <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
            stroke={2}
          />
        </div>
      ))}
    </div>
  );
}

function AnswerReviewList({ results }: { results: QuestionResult[] }) {
  if (results.length === 0) return null;

  return (
    <div className="w-full max-w-md mt-6">
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
        Tus respuestas
      </h3>
      <div className="bg-white border-4 border-slate-200 rounded-[1.5rem] p-4 shadow-[0_4px_0_0_#e2e8f0] space-y-3">
        {results.map((r, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 ${r.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}
          >
            <span className="shrink-0">
              {r.isCorrect ? (
                <IconCircleCheck className="w-6 h-6 text-emerald-500" />
              ) : (
                <IconCircleX className="w-6 h-6 text-rose-500" />
              )}
            </span>
            <span className="text-sm font-bold text-slate-700 truncate flex-1">{r.question}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompletedPanel({
  onRestart,
  isRepeat = false,
  xpEarned,
  accuracy,
  questionResults = [],
}: CompletedPanelProps) {
  const { playSprite } = useAudio();

  useEffect(() => {
    const timer = setTimeout(() => {
      playSprite(isRepeat ? SpriteAudioEvent.ActivityStart : SpriteAudioEvent.LessonComplete);
    }, 300);
    return () => clearTimeout(timer);
  }, [playSprite, isRepeat]);

  const tierConfig = accuracy ? TIER_CONFIG[accuracy.tier] : null;
  const stars = tierConfig?.stars ?? 1;
  const hasBonus = accuracy?.allCorrectOnFirstAttempt && accuracy?.accuracyPercent === 100;
  const displayXP = xpEarned ?? 50;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center gap-5 w-full h-full animate-bounce-in overflow-y-auto custom-scrollbar">
      {/* Dynamic Header Badge */}
      <div className="relative w-36 h-36 sm:w-40 sm:h-40">
        <div
          className={`absolute inset-0 rounded-full animate-ping opacity-40 blur-xl ${isRepeat ? 'bg-sky-200' : 'bg-amber-300'}`}
        />
        <div
          className={`absolute inset-0 rounded-full border-8 border-white flex items-center justify-center z-10 animate-float ${isRepeat ? 'bg-gradient-to-tr from-sky-400 to-cyan-300 shadow-[0_10px_0_0_#0284c7]' : 'bg-gradient-to-tr from-amber-400 to-yellow-300 shadow-[0_12px_0_0_#d97706]'}`}
        >
          {isRepeat ? (
            <IconRefresh className="w-20 h-20 text-white drop-shadow-md" />
          ) : (
            <>
              <IconTrophyFilled className="w-16 h-16 sm:w-20 sm:h-20 text-white drop-shadow-md" />
              <IconStars className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-10 h-10 sm:w-12 sm:h-12 text-amber-500 animate-pulse" />
            </>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight">
          {isRepeat ? '¡Práctica Completada!' : '¡Misión Cumplida!'}
        </h2>
        <p className="text-lg sm:text-xl text-slate-500 font-bold">
          {isRepeat ? 'Repetiste esta lección con éxito.' : 'Has conquistado este desafío.'}
        </p>
      </div>

      {tierConfig ? (
        <div className="flex flex-col items-center gap-2 mt-2">
          <StarRating stars={stars} />
          <span className={`text-lg font-black ${tierConfig.color}`}>{tierConfig.label}</span>
        </div>
      ) : null}

      {/* Conditional Gamification Stats */}
      {!isRepeat && accuracy ? (
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-lg mt-4">
          <div className="flex-1 bg-gradient-to-br from-amber-50 to-yellow-50 border-4 border-amber-200 rounded-[1.5rem] p-4 flex flex-col items-center justify-center relative overflow-hidden">
            {hasBonus ? (
              <div className="absolute top-0 right-0 bg-amber-400 text-white text-xs font-black px-2 py-1 rounded-bl-lg">
                +20 BONUS
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 mb-1">
              <IconStar className="w-5 h-5 text-amber-500 fill-current" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                XP Ganada
              </span>
            </div>
            <span className="text-4xl font-black text-amber-600">+{displayXP}</span>
          </div>

          <div className="flex-1 bg-gradient-to-br from-emerald-50 to-green-50 border-4 border-emerald-200 rounded-[1.5rem] p-4 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <IconTargetArrow className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                Precisión
              </span>
            </div>
            <span className="text-4xl font-black text-emerald-600">
              {accuracy.accuracyPercent}%
            </span>
            <span className="text-xs font-bold text-emerald-500 mt-1">
              {accuracy.correctLastAttempts}/{accuracy.totalActivities} correctas
            </span>
          </div>
        </div>
      ) : null}

      {isRepeat ? (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border-2 border-amber-200 rounded-full mt-2">
          <span className="text-lg">⭐</span>
          <span className="text-sm font-bold text-amber-700">XP se otorga solo la primera vez</span>
        </div>
      ) : null}

      {/* Review & Feedback Actions */}
      <AnswerReviewList results={questionResults} />

      <div className="flex flex-col sm:flex-row gap-4 mt-6 w-full max-w-xl">
        <button
          onClick={onRestart}
          className="flex-1 flex items-center justify-center gap-3 px-5 py-4 bg-white text-slate-600 font-black text-lg rounded-[2rem] border-4 border-slate-200 shadow-[0_6px_0_0_#e2e8f0] hover:bg-sky-50 hover:border-sky-300 hover:shadow-[0_6px_0_0_#7dd3fc] hover:text-sky-600 hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all outline-none"
        >
          <IconRepeat className="w-6 h-6" stroke={3} />
          Repetir
        </button>
        <Link to="/dashboard" className="flex-1 outline-none">
          <button className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-sky-500 text-white font-black text-lg rounded-[2rem] border-4 border-sky-600 shadow-[0_6px_0_0_#0284c7] hover:bg-sky-400 hover:shadow-[0_8px_0_0_#0284c7] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all outline-none">
            {isRepeat ? (
              <IconMap className="w-6 h-6" stroke={3} />
            ) : (
              <IconArrowRight className="w-6 h-6" stroke={3} />
            )}
            {isRepeat ? 'Volver al Mapa' : 'Siguiente Misión'}
          </button>
        </Link>
      </div>
    </div>
  );
}
