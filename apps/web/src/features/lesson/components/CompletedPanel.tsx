import { useEffect } from 'react';
import {
  IconRepeat,
  IconMap,
  IconTrophyFilled,
  IconStars,
  IconRefresh,
  IconArrowRight,
  IconTargetArrow,
  IconStar,
  IconBolt,
  IconChecks,
  IconCircleCheck,
  IconCircleX,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { useAudio } from '@/contexts/AudioContext';
import { SpriteAudioEvent } from '@/audio/types/audio-events';

export interface QuestionResult {
  question: string;
  isCorrect: boolean;
}

export interface CompletedPanelProps {
  onRestart: () => void;
  isRepeat?: boolean;
  xpEarned?: number;
  accuracy?: {
    correctFirstAttempts: number;
    correctLastAttempts: number;
    totalActivities: number;
    skippedActivities: number;
    accuracyPercent: number;
    allCorrectOnFirstAttempt: boolean;
    tier: 'perfect' | 'high' | 'medium' | 'low';
  };
  questionResults?: QuestionResult[];
}

const TIER_CONFIG = {
  perfect: {
    label: '¡Dominado!',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    stars: 3,
  },
  high: {
    label: '¡Excelente!',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    stars: 2,
  },
  medium: {
    label: '¡Bien!',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    stars: 1,
  },
  low: {
    label: '¡Sigue practicando!',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    stars: 1,
  },
};

function StarRating({ stars, animate = true }: { stars: number; animate?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`transition-all ${animate ? 'animate-bounce-in' : ''}`}
          style={
            animate ? { animationDelay: `${i * 200}ms`, animationFillMode: 'both' } : undefined
          }
        >
          <IconStar
            className={`w-12 h-12 sm:w-14 sm:h-14 ${
              i <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'
            }`}
            stroke={2}
          />
        </div>
      ))}
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
  const canImprove = stars < 3;

  if (isRepeat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-8 w-full h-full animate-bounce-in overflow-y-auto custom-scrollbar">
        <div className="relative w-40 h-40">
          <div className="absolute inset-0 bg-sky-200 rounded-full animate-ping opacity-30 blur-xl" />
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-400 to-cyan-300 rounded-full shadow-[0_10px_0_0_#0284c7] border-8 border-white flex items-center justify-center z-10 animate-float">
            <IconRefresh className="w-20 h-20 text-white drop-shadow-md" />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight">
            ¡Práctica Completada!
          </h2>
          <p className="text-xl text-slate-500 font-bold">Repetiste esta lección con éxito.</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border-2 border-amber-200 rounded-full">
            <span className="text-lg">⭐</span>
            <span className="text-sm font-bold text-amber-700">
              XP se otorga solo la primera vez
            </span>
          </div>
        </div>

        {/* Star rating for repeat */}
        {accuracy ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Tu resultado
            </p>
            <StarRating stars={stars} />
            {tierConfig ? (
              <span className={`text-lg font-black ${tierConfig.color}`}>{tierConfig.label}</span>
            ) : null}
          </div>
        ) : null}

        {/* Per-question review for repeat */}
        {questionResults.length > 0 ? (
          <div className="w-full max-w-md">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
              Tus respuestas
            </h3>
            <div className="bg-white border-4 border-slate-200 rounded-[1.5rem] p-4 shadow-[0_4px_0_0_#e2e8f0]">
              <div className="space-y-3">
                {questionResults.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                      r.isCorrect
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-rose-50 border-rose-200'
                    }`}
                  >
                    <span className="shrink-0">
                      {r.isCorrect ? (
                        <IconCircleCheck className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <IconCircleX className="w-6 h-6 text-rose-500" />
                      )}
                    </span>
                    <span className="text-sm font-bold text-slate-700 truncate flex-1">
                      {r.question}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {canImprove ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-50 border-2 border-sky-200 rounded-full">
            <span className="text-lg">💪</span>
            <span className="text-sm font-bold text-sky-700">
              ¡Puedes conseguir más estrellas! Inténtalo de nuevo
            </span>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-4 mt-6 w-full max-w-xl">
          <button
            onClick={onRestart}
            className="flex-1 flex items-center justify-center gap-3 px-5 py-4 bg-white text-slate-600 font-black text-lg rounded-[2rem] border-4 border-slate-200 shadow-[0_6px_0_0_#e2e8f0] hover:bg-sky-50 hover:border-sky-300 hover:shadow-[0_6px_0_0_#7dd3fc] hover:text-sky-600 hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer outline-none"
          >
            <IconRepeat className="w-6 h-6" stroke={3} />
            Repetir de nuevo
          </button>
          <Link to="/dashboard" className="flex-1 outline-none">
            <button className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-sky-500 text-white font-black text-lg rounded-[2rem] border-4 border-sky-600 shadow-[0_6px_0_0_#0284c7] hover:bg-sky-400 hover:shadow-[0_8px_0_0_#0284c7] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer outline-none">
              <IconMap className="w-6 h-6" stroke={3} />
              Volver al Mapa
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // UI para primera completación (con XP)
  const displayXP = xpEarned ?? 50;
  const displayAccuracy = accuracy?.accuracyPercent ?? 100;
  const correctAnswers = accuracy?.correctLastAttempts ?? 0;
  const totalActivities = accuracy?.totalActivities ?? 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center gap-5 w-full h-full animate-bounce-in overflow-y-auto custom-scrollbar">
      <div className="relative w-36 h-36 sm:w-40 sm:h-40">
        <div className="absolute inset-0 bg-amber-300 rounded-full animate-ping opacity-40 blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-full shadow-[0_12px_0_0_#d97706] border-8 border-white flex items-center justify-center z-10 animate-float">
          <IconTrophyFilled className="w-16 h-16 sm:w-20 sm:h-20 text-white drop-shadow-md" />
          <IconStars className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-10 h-10 sm:w-12 sm:h-12 text-amber-500 animate-pulse" />
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight">
          ¡Misión Cumplida!
        </h2>
        <p className="text-lg sm:text-xl text-slate-500 font-bold">Has conquistado este desafío.</p>
      </div>

      {/* Star Rating */}
      {tierConfig ? (
        <div className="flex flex-col items-center gap-2">
          <StarRating stars={stars} />
          <span className={`text-lg font-black ${tierConfig.color}`}>{tierConfig.label}</span>
        </div>
      ) : null}

      {/* Stats Cards */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-lg">
        {/* XP Card */}
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
          {hasBonus ? (
            <span className="text-xs font-bold text-amber-500 mt-1">
              (50 base + 20 bonus primer intento)
            </span>
          ) : null}
        </div>

        {/* Accuracy Card */}
        <div className="flex-1 bg-gradient-to-br from-emerald-50 to-green-50 border-4 border-emerald-200 rounded-[1.5rem] p-4 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 mb-1">
            <IconTargetArrow className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Precisión
            </span>
          </div>
          <span className="text-4xl font-black text-emerald-600">{displayAccuracy}%</span>
          {totalActivities > 0 ? (
            <span className="text-xs font-bold text-emerald-500 mt-1">
              {correctAnswers}/{totalActivities} correctas
            </span>
          ) : null}
        </div>
      </div>

      {/* Bonus Explanation */}
      {hasBonus ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-2 border-violet-200 rounded-full">
          <IconBolt className="w-5 h-5 text-violet-500" />
          <span className="text-sm font-bold text-violet-700">
            ¡Bonus! Respondiste todo correcto al primer intento
          </span>
        </div>
      ) : null}

      {/* Encouragement for non-perfect scores */}
      {!hasBonus && accuracy && accuracy.accuracyPercent === 100 ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-sky-50 border-2 border-sky-200 rounded-full">
          <IconChecks className="w-5 h-5 text-sky-500" />
          <span className="text-sm font-bold text-sky-700">
            ¡Lo lograste! Aprendiste de tus errores
          </span>
        </div>
      ) : null}

      {/* Per-question answer review */}
      {questionResults.length > 0 ? (
        <div className="w-full max-w-md">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
            Tus respuestas
          </h3>
          <div className="bg-white border-4 border-slate-200 rounded-[1.5rem] p-4 shadow-[0_4px_0_0_#e2e8f0]">
            <div className="space-y-3">
              {questionResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                    r.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                  }`}
                >
                  <span className="shrink-0">
                    {r.isCorrect ? (
                      <IconCircleCheck className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <IconCircleX className="w-6 h-6 text-rose-500" />
                    )}
                  </span>
                  <span className="text-sm font-bold text-slate-700 truncate flex-1">
                    {r.question}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Repeat encouragement - kid friendly */}
      {canImprove ? (
        <div className="flex items-center gap-2 px-5 py-3 bg-sky-50 border-4 border-sky-200 shadow-[0_4px_0_0_#bae6fd] rounded-2xl">
          <span className="text-2xl">🎯</span>
          <span className="text-base font-black text-sky-700">
            ¡Juega de nuevo para conseguir las 3 estrellas! ⭐
          </span>
        </div>
      ) : null}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mt-2 w-full max-w-xl">
        <button
          onClick={onRestart}
          className="flex-1 flex items-center justify-center gap-3 px-5 py-4 bg-white text-slate-600 font-black text-lg rounded-[2rem] border-4 border-slate-200 shadow-[0_6px_0_0_#e2e8f0] hover:bg-sky-50 hover:border-sky-300 hover:shadow-[0_6px_0_0_#7dd3fc] hover:text-sky-600 hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer outline-none"
        >
          <IconRepeat className="w-6 h-6" stroke={3} />
          Repetir
        </button>
        <Link to="/dashboard" className="flex-1 outline-none">
          <button className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-sky-500 text-white font-black text-lg rounded-[2rem] border-4 border-sky-600 shadow-[0_6px_0_0_#0284c7] hover:bg-sky-400 hover:shadow-[0_8px_0_0_#0284c7] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer outline-none">
            <IconArrowRight className="w-6 h-6" stroke={3} />
            Siguiente Misión
          </button>
        </Link>
      </div>
    </div>
  );
}
