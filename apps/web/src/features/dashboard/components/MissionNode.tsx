import { Link } from 'react-router-dom';
import {
  IconLock,
  IconStar,
  IconSchool,
  IconTrophy,
  IconPlayerPlayFilled,
  IconRefresh,
  IconChevronDown,
  IconMapPinFilled,
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

const THEME: Record<LessonStatus, { btn: string; icon: React.ElementType; tag: string }> = {
  [LESSON_STATUS.MASTERED]: {
    btn: 'bg-amber-400 border-amber-500 text-white shadow-[0_6px_0_0_#d97706]',
    icon: IconTrophy,
    tag: '¡Completada!',
  },
  [LESSON_STATUS.PRACTICED]: {
    btn: 'bg-sky-400 border-sky-500 text-white shadow-[0_6px_0_0_#0284c7]',
    icon: IconRefresh,
    tag: 'Repasar',
  },
  [LESSON_STATUS.IN_PROGRESS]: {
    btn: 'bg-emerald-400 border-emerald-500 text-white shadow-[0_6px_0_0_#059669]',
    icon: IconSchool,
    tag: 'En Progreso',
  },
  [LESSON_STATUS.AVAILABLE]: {
    btn: 'bg-emerald-400 border-emerald-500 text-white shadow-[0_6px_0_0_#059669]',
    icon: IconSchool,
    tag: '¡Nueva!',
  },
  [LESSON_STATUS.LOCKED]: {
    btn: 'bg-slate-200 border-slate-300 text-slate-400 shadow-[0_6px_0_0_#94a3b8]',
    icon: IconLock,
    tag: 'Bloqueada',
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
    <div className="relative flex flex-col items-center group w-36 sm:w-40 transition-all duration-300">
      {/* Popover de Lecciones (Aparece con animación rebotante) */}
      {isActive ? (
        <div className="absolute bottom-[calc(100%+24px)] left-1/2 -translate-x-1/2 z-50 w-[280px] sm:w-[320px] bg-white rounded-[2rem] p-5 shadow-[0_20px_40px_rgba(14,165,233,0.25)] border-4 border-sky-100 animate-in slide-in-from-bottom-4 zoom-in-95 fade-in duration-300">
          <div className="text-center mb-4 px-2">
            <span className="inline-flex items-center gap-1.5 bg-sky-100 text-sky-700 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest mb-3 border-2 border-sky-200 shadow-sm">
              <IconMapPinFilled className="w-3.5 h-3.5 text-sky-500" />
              Tu Misión
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-800 text-balance leading-snug line-clamp-2">
              {classItem.title}
            </h3>
          </div>

          {totalLessons > 0 ? (
            <div className="space-y-3 max-h-[240px] overflow-y-auto custom-scrollbar pr-2 pb-2">
              {classItem.lessons?.map((lesson, idx) => (
                <Link
                  key={lesson.id}
                  to={`/lesson/${lesson.id}`}
                  className="w-full flex items-center gap-4 p-3.5 bg-slate-50 hover:bg-sky-50 rounded-[1.5rem] border-2 border-b-4 border-slate-200 hover:border-sky-300 hover:border-b-sky-400 active:border-b-2 active:translate-y-[2px] transition-all text-left outline-none focus-visible:ring-4 focus-visible:ring-sky-200 group/lesson"
                  onClick={onInteract}
                >
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-base font-black text-slate-400 group-hover/lesson:text-sky-600 group-hover/lesson:bg-sky-100 border-2 border-slate-200 group-hover/lesson:border-sky-200 shrink-0 shadow-sm transition-colors">
                    {idx + 1}
                  </div>
                  <span className="flex-1 text-sm font-bold text-slate-700 truncate group-hover/lesson:text-slate-900">
                    {lesson.recipe?.title || `Nivel ${idx + 1}`}
                  </span>
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 border-2 border-emerald-200 shadow-sm group-hover/lesson:bg-emerald-500 group-hover/lesson:scale-110 transition-all">
                    <IconPlayerPlayFilled className="w-5 h-5 text-emerald-500 group-hover/lesson:text-white ml-0.5 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="w-full text-center py-6 bg-slate-50 rounded-[1.5rem] border-2 border-slate-200 border-b-4 mt-2">
              <span className="text-slate-400 font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                <IconLock className="w-4 h-4" /> Próximamente
              </span>
            </div>
          )}

          {/* Flecha del Popover */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-sky-100 rotate-45 z-[-1]" />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rotate-45 z-10" />
        </div>
      ) : null}

      {/* Indicador flotante sobre el nodo (Solo si está disponible/nueva) */}
      {isAvailable && !isActive && !isMastered ? (
        <div className="absolute -top-6 z-20 animate-bounce">
          <span className="bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border-2 border-amber-500 shadow-sm">
            ¡Aquí!
          </span>
        </div>
      ) : null}

      {/* Botón Principal (Gominola Táctil) */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex justify-center items-center z-10">
        {isMastered ? (
          <IconStar className="absolute -top-3 -right-3 w-10 h-10 text-amber-400 fill-amber-400 animate-[bounce_2s_infinite] z-20 drop-shadow-md" />
        ) : null}

        <button
          onClick={() => {
            onInteract();
            onSetActive();
          }}
          className={`
            relative w-full h-full rounded-[2.5rem] flex items-center justify-center transition-all outline-none z-10 border-b-[8px] focus-visible:ring-4 focus-visible:ring-sky-300 focus-visible:ring-offset-4 focus-visible:ring-offset-sky-50
            ${theme.btn}
            ${
              isActive && !isLocked
                ? 'translate-y-[8px] border-b-0 shadow-none scale-[1.02]'
                : 'hover:-translate-y-1 active:translate-y-[8px] active:border-b-0 active:shadow-none hover:scale-105'
            }
          `}
          aria-label={`Misión: ${classItem.title}`}
          aria-expanded={isActive}
        >
          <NodeIcon
            className={`w-10 h-10 sm:w-12 sm:h-12 ${isAvailable && !isActive ? 'animate-[pulse_2s_infinite] drop-shadow-md' : ''}`}
            stroke={2.5}
          />
        </button>
      </div>

      {/* Tarjeta de Información Inferior */}
      <button
        onClick={() => {
          onInteract();
          onSetActive();
        }}
        className={`
          mt-4 w-[115%] sm:w-[125%] px-3 py-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all outline-none z-0 focus-visible:ring-4 focus-visible:ring-sky-200
          ${
            isActive && !isLocked
              ? 'bg-sky-50 border-sky-300 shadow-none translate-y-1'
              : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-sm hover:border-sky-300 hover:bg-sky-50/80'
          }
        `}
      >
        <div className="h-[2.8rem] flex items-center justify-center w-full px-1">
          <span className="text-xs sm:text-sm font-black text-slate-700 tracking-tight text-center leading-snug line-clamp-2 text-balance break-words">
            {classItem.title}
          </span>
        </div>

        <div className="mt-1.5 flex items-center justify-center gap-1 w-full bg-slate-100 rounded-full py-0.5 px-2">
          <span
            className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-sky-600' : 'text-slate-500'}`}
          >
            {totalLessons} {totalLessons === 1 ? 'Nivel' : 'Niveles'}
          </span>
          <IconChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-300 ${isActive ? 'rotate-180 text-sky-600' : 'text-slate-400'}`}
            stroke={3}
          />
        </div>

        {/* Minibarra de Progreso con borde tipo gummy */}
        {progressPercent > 0 && !isMastered ? (
          <div className="w-14 h-2 bg-slate-200 rounded-full mt-2.5 overflow-hidden border border-slate-300 shadow-inner relative">
            <div
              className="absolute top-0 left-0 h-full bg-emerald-400 border-t border-emerald-300 rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        ) : null}
      </button>
    </div>
  );
}
