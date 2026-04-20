import { Link } from 'react-router-dom';
import {
  IconLock,
  IconStar,
  IconSchool,
  IconTrophy,
  IconPlayerPlay,
  IconRefresh,
  IconChevronDown,
} from '@tabler/icons-react';

import { LESSON_STATUS, type LessonStatus } from '../constants/dashboard.constants';
import type { ClassContext } from '../utils/classContext.util';

import type { Class } from '@/services/api';

interface MissionNodeProps {
  classItem: Class;
  context: ClassContext;
  onInteract: () => void;
  isActive: boolean;
  onSetActive: () => void;
}

const THEME: Record<LessonStatus, { btn: string; icon: React.ElementType }> = {
  [LESSON_STATUS.MASTERED]: {
    btn: 'bg-amber-400 border-amber-500 text-white shadow-[0_4px_0_0_#f59e0b]',
    icon: IconTrophy,
  },
  [LESSON_STATUS.PRACTICED]: {
    btn: 'bg-sky-400 border-sky-500 text-white shadow-[0_4px_0_0_#0ea5e9]',
    icon: IconRefresh,
  },
  [LESSON_STATUS.IN_PROGRESS]: {
    btn: 'bg-emerald-400 border-emerald-500 text-white shadow-[0_4px_0_0_#10b981]',
    icon: IconSchool,
  },
  [LESSON_STATUS.AVAILABLE]: {
    btn: 'bg-emerald-400 border-emerald-500 text-white shadow-[0_4px_0_0_#10b981]',
    icon: IconSchool,
  },
  [LESSON_STATUS.LOCKED]: {
    btn: 'bg-slate-200 border-slate-300 text-slate-400 shadow-[0_4px_0_0_#cbd5e1]',
    icon: IconLock,
  },
};

export function MissionNode({
  classItem,
  context,
  onInteract,
  isActive,
  onSetActive,
}: MissionNodeProps) {
  const { status, progressPercent, totalLessons } = context;

  const isLocked = status === LESSON_STATUS.LOCKED;
  const isMastered = status === LESSON_STATUS.MASTERED;
  const isAvailable = status === LESSON_STATUS.AVAILABLE || status === LESSON_STATUS.IN_PROGRESS;

  const theme = THEME[status] || THEME[LESSON_STATUS.LOCKED];
  const NodeIcon = theme.icon;

  return (
    <div className="relative flex flex-col items-center group w-32 sm:w-36 transition-all duration-300">
      {/* Popover con Selector de Lecciones */}
      {isActive ? (
        <div className="absolute bottom-[calc(100%+16px)] left-1/2 -translate-x-1/2 z-50 w-[280px] sm:w-[320px] bg-white rounded-[2rem] p-5 shadow-[0_16px_32px_rgba(14,165,233,0.2)] border-4 border-sky-100 animate-in zoom-in-95 fade-in duration-200">
          <div className="text-center mb-4 px-2">
            <span className="inline-block bg-sky-100 text-sky-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-2 border-2 border-sky-200 shadow-sm">
              🎒 Tu Clase
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-800 text-balance leading-tight line-clamp-2">
              {classItem.title}
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">Elige tu aventura:</p>
          </div>

          {totalLessons > 0 ? (
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-2 pb-2">
              {classItem.lessons?.map((lesson, idx) => (
                <Link
                  key={lesson.id}
                  to={`/lesson/${lesson.id}`}
                  className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-sky-50 rounded-[1.25rem] border-2 border-b-4 border-slate-200 hover:border-sky-300 hover:border-b-sky-400 active:border-b-2 active:translate-y-[2px] transition-all text-left outline-none group/lesson"
                  onClick={onInteract}
                >
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-sm font-black text-slate-400 group-hover/lesson:text-sky-600 group-hover/lesson:bg-sky-100 border-2 border-slate-200 group-hover/lesson:border-transparent shrink-0 transition-colors shadow-sm">
                    {idx + 1}
                  </div>
                  <span className="flex-1 text-sm font-bold text-slate-700 truncate group-hover/lesson:text-slate-900">
                    {lesson.recipe?.title || `Lección ${idx + 1}`}
                  </span>
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 border-2 border-emerald-200 shadow-sm group-hover/lesson:bg-emerald-500 transition-colors">
                    <IconPlayerPlay
                      className="w-4 h-4 text-emerald-600 group-hover/lesson:text-white ml-0.5 transition-colors"
                      fill="currentColor"
                    />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="w-full text-center py-6 bg-slate-50 rounded-[1.25rem] border-2 border-slate-200 border-b-4 mt-2">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">
                Próximamente...
              </span>
            </div>
          )}

          {/* Flechas del Popover */}
          <div className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 w-5 h-5 bg-sky-100 rotate-45 z-[-1]" />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rotate-45 z-10" />
        </div>
      ) : null}

      {/* Botón Principal (Gominola Táctil) */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex justify-center items-center z-10">
        {isMastered ? (
          <IconStar className="absolute -top-2 -right-2 w-8 h-8 text-amber-400 fill-amber-400 animate-pulse z-20 drop-shadow-md" />
        ) : null}

        <button
          onClick={() => {
            onInteract();
            onSetActive();
          }}
          className={`
            relative w-full h-full rounded-[2rem] flex items-center justify-center transition-all outline-none z-10 border-b-[6px]
            ${theme.btn}
            ${
              isActive && !isLocked
                ? 'translate-y-[6px] border-b-0 shadow-none scale-105'
                : 'hover:-translate-y-1 active:translate-y-[6px] active:border-b-0 active:shadow-none'
            }
          `}
          aria-label={`Clase: ${classItem.title}`}
          aria-expanded={isActive}
        >
          <NodeIcon
            className={`w-8 h-8 sm:w-10 sm:h-10 ${isAvailable && !isActive ? 'animate-bounce drop-shadow-sm' : ''}`}
            stroke={2.5}
          />

          {isAvailable && !isActive ? (
            <div className="absolute inset-[-6px] border-2 border-emerald-400/40 rounded-[2rem] animate-[ping_3s_ease-in-out_infinite] pointer-events-none" />
          ) : null}
        </button>
      </div>

      {/* Tarjeta de Información Agrupada (Título + Botón Lecciones) */}
      <button
        onClick={() => {
          onInteract();
          onSetActive();
        }}
        className={`
          mt-3 w-[115%] sm:w-[125%] px-3 py-2.5 rounded-2xl border-2 flex flex-col items-center justify-center transition-all outline-none z-0
          ${
            isActive && !isLocked
              ? 'bg-sky-50 border-sky-300 shadow-none translate-y-1'
              : 'bg-white/90 backdrop-blur-sm border-slate-200/80 shadow-sm hover:border-sky-300 hover:bg-sky-50/80'
          }
        `}
      >
        {/* Título: Tipografía más legible, tamaño adecuado */}
        <div className="h-[2.4rem] flex items-center justify-center w-full px-1">
          <span className="text-xs sm:text-[13px] font-black text-slate-700 tracking-tight text-center leading-[1.15] line-clamp-2 text-balance break-words">
            {classItem.title}
          </span>
        </div>

        {/* Indicador de Lecciones con texto dinámico y completo */}
        <div className="mt-1 flex items-center gap-1">
          <span
            className={`text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${isActive ? 'text-sky-600' : 'text-slate-500'}`}
          >
            {totalLessons} {totalLessons === 1 ? 'Lección' : 'Lecciones'}
          </span>
          <IconChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-300 ${isActive ? 'rotate-180 text-sky-600' : 'text-slate-400'}`}
            stroke={3}
          />
        </div>

        {/* Minibarra de Progreso (si aplica) */}
        {progressPercent > 0 && !isMastered ? (
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden border border-slate-300 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        ) : null}
      </button>
    </div>
  );
}
