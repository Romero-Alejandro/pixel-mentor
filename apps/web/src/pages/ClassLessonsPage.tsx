import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  IconBook,
  IconCloud,
  IconSchool,
  IconStar,
  IconLock,
  IconTrophy,
} from '@tabler/icons-react';

import { api } from '@/services/api';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import {
  LESSON_STATUS,
  type LessonStatus,
} from '@/features/dashboard/constants/dashboard.constants';

export interface ClassLesson {
  id: string;
  title: string;
  recipeId: string;
  order: number;
  status?: LessonStatus;
}

export interface ClassData {
  id: string;
  title: string;
  lessons: ClassLesson[];
}

const THEME: Record<LessonStatus, { btn: string; icon: React.ElementType; label: string }> = {
  [LESSON_STATUS.MASTERED]: {
    btn: 'bg-amber-400 border-amber-500 text-white shadow-[0_4px_0_0_#f59e0b]',
    icon: IconTrophy,
    label: '¡Completada!',
  },
  [LESSON_STATUS.PRACTICED]: {
    btn: 'bg-sky-400 border-sky-500 text-white shadow-[0_4px_0_0_#0ea5e9]',
    icon: IconStar,
    label: '¡Practicada!',
  },
  [LESSON_STATUS.IN_PROGRESS]: {
    btn: 'bg-emerald-400 border-emerald-500 text-white shadow-[0_4px_0_0_#10b981]',
    icon: IconSchool,
    label: 'En progreso',
  },
  [LESSON_STATUS.AVAILABLE]: {
    btn: 'bg-emerald-400 border-emerald-500 text-white shadow-[0_4px_0_0_#10b981]',
    icon: IconSchool,
    label: '¡Disponible!',
  },
  [LESSON_STATUS.LOCKED]: {
    btn: 'bg-slate-200 border-slate-300 text-slate-400 shadow-[0_4px_0_0_#cbd5e1]',
    icon: IconLock,
    label: 'Bloqueada',
  },
};

const ANIMATION_STAGGER_DELAY_MS = 150;

export function ClassLessonsPage() {
  const { classId } = useParams<{ classId: string }>();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadClassData = async () => {
      if (!classId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await api.getClass(classId);
        const lessons: ClassLesson[] = response.lessons.map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title ?? lesson.recipe?.title ?? 'Untitled Lesson',
          recipeId: lesson.recipeId,
          order: lesson.order,
          status: LESSON_STATUS.AVAILABLE,
        }));

        setClassData({
          id: response.id,
          title: response.title,
          lessons: lessons.sort((a, b) => a.order - b.order),
        });
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Failed to load class data');
      } finally {
        setLoading(false);
      }
    };

    loadClassData();
  }, [classId]);

  if (loading && !classData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f9ff]">
        <div className="text-center">
          <Spinner size="lg" className="text-sky-500" />
          <p className="mt-4 text-sky-800 font-bold">Cargando clase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border-4 border-rose-100 rounded-2xl text-rose-600">
        Error al cargar la clase: {error}
        <Button variant="secondary" onClick={() => navigate('/my-learning')} className="mt-4">
          Volver al aprendizaje
        </Button>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="text-center py-16 bg-slate-50 rounded-3xl border-4 border-slate-100">
        <p className="text-slate-500 font-medium">Clase no encontrada</p>
        <Button variant="secondary" onClick={() => navigate('/my-learning')} className="mt-4">
          Volver al aprendizaje
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col">
      <div className="flex items-center justify-between border-b pb-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <IconBook className="text-sky-500" size={24} />
          <h1 className="text-2xl font-black">{classData.title}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <IconUserAccess />
          <span className="hidden sm:inline">Acceso mediante grupo de aprendizaje</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {classData.lessons.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Esta clase no tiene lecciones disponibles aún.</p>
            <p className="text-sm text-slate-400 mt-2">
              Contacta a tu profesor para que añada lecciones a esta clase.
            </p>
          </div>
        ) : (
          <LessonMissionMap lessons={classData.lessons} />
        )}
      </div>

      <div className="border-t pt-4 px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => navigate('/my-learning')}>
            Volver al aprendizaje
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconUserAccess() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

interface LessonMissionMapProps {
  lessons: ClassLesson[];
}

function LessonMissionMap({ lessons }: LessonMissionMapProps) {
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const navigate = useNavigate();

  const getOffsetClass = (index: number) => {
    const cycle = index % 4;
    switch (cycle) {
      case 0:
        return 'translate-x-0';
      case 1:
        return '-translate-x-12 sm:-translate-x-20';
      case 2:
        return 'translate-x-0';
      case 3:
        return 'translate-x-12 sm:translate-x-20';
      default:
        return 'translate-x-0';
    }
  };

  if (lessons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-bounce-in">
        <div className="w-24 h-24 bg-sky-100 rounded-[2rem] flex items-center justify-center mb-6 border-4 border-sky-200 shadow-sm">
          <IconSchool className="w-12 h-12 text-sky-400" stroke={2.5} />
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-3">¡Ánimo!</h3>
        <p className="text-slate-500 font-bold text-lg max-w-sm">
          Completa cada misión para desbloquear la siguiente.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pt-16 pb-20 flex flex-col items-center w-full max-w-md mx-auto overflow-visible">
      {/* Decorative clouds */}
      <IconCloud
        className="absolute top-8 left-4 w-16 h-16 text-sky-100/80 animate-[pulse_4s_ease-in-out_infinite] pointer-events-none"
        fill="currentColor"
        stroke={0}
      />
      <IconCloud
        className="absolute top-1/4 right-0 w-24 h-24 text-sky-200/40 animate-[bounce_6s_ease-in-out_infinite] pointer-events-none"
        fill="currentColor"
        stroke={0}
      />

      {/* Path line */}
      <div className="absolute top-12 bottom-12 left-1/2 -translate-x-1/2 w-20 sm:w-28 bg-sky-50/80 rounded-full z-0 shadow-[inset_0_0_15px_rgba(186,230,253,0.5)] border-x-4 border-sky-100/50 backdrop-blur-sm pointer-events-none" />

      <div
        className="absolute inset-0 w-full h-full z-0 pointer-events-none flex justify-center opacity-80"
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 2%, black 10%, black 90%, transparent 98%)',
          maskImage:
            'linear-gradient(to bottom, transparent 2%, black 10%, black 90%, transparent 98%)',
        }}
      >
        <svg className="w-4 sm:w-6 h-full" preserveAspectRatio="none">
          <line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke="#7dd3fc"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="0 24"
          />
        </svg>
      </div>

      {/* Mission nodes */}
      <div className="flex flex-col gap-10 sm:gap-16 w-full relative px-4">
        {lessons.map((lesson, idx) => {
          const status = lesson.status || LESSON_STATUS.AVAILABLE;
          const isActive = activeLessonId === lesson.id;
          const offsetClass = getOffsetClass(idx);

          return (
            <div
              key={lesson.id}
              className={`flex w-full justify-center ${offsetClass} relative transition-transform duration-500 animate-in fade-in slide-in-from-bottom-8`}
              style={{
                animationDelay: `${idx * ANIMATION_STAGGER_DELAY_MS}ms`,
                animationFillMode: 'both',
              }}
            >
              <LessonNode
                lesson={lesson}
                status={status}
                isActive={isActive}
                onSetActive={() =>
                  setActiveLessonId(activeLessonId === lesson.id ? null : lesson.id)
                }
                onComplete={() => navigate(`/lesson/${lesson.id}`)}
              />
            </div>
          );
        })}
      </div>

      {/* Glow effect at bottom */}
      <div className="w-64 sm:w-80 h-20 bg-emerald-200/40 blur-2xl rounded-[100%] absolute bottom-0 z-0 pointer-events-none" />
    </div>
  );
}

interface LessonNodeProps {
  lesson: ClassLesson;
  status: LessonStatus;
  isActive: boolean;
  onSetActive: () => void;
  onComplete: () => void;
}

function LessonNode({ lesson, status, isActive, onSetActive, onComplete }: LessonNodeProps) {
  const theme = THEME[status] || THEME[LESSON_STATUS.AVAILABLE];
  const NodeIcon = theme.icon;

  const isLocked = status === LESSON_STATUS.LOCKED;
  const isMastered = status === LESSON_STATUS.MASTERED;

  return (
    <div className="relative flex flex-col items-center group w-32 sm:w-36 transition-all duration-300">
      {/* Popover */}
      {isActive && !isLocked ? (
        <div className="absolute bottom-[calc(100%+16px)] left-1/2 -translate-x-1/2 z-50 w-[280px] sm:w-[320px] bg-white rounded-[2rem] p-5 shadow-[0_16px_32px_rgba(14,165,233,0.2)] border-4 border-sky-100 animate-in zoom-in-95 fade-in duration-200">
          <div className="text-center mb-4 px-2">
            <span className="inline-block bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-2 border-2 border-amber-200 shadow-sm">
              ⚡ ¡Misión #{lesson.order + 1}!
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-800 text-balance leading-tight line-clamp-2">
              {lesson.title}
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">{theme.label}</p>
          </div>

          <button
            onClick={onComplete}
            className="w-full py-3 bg-emerald-400 hover:bg-emerald-500 text-white rounded-[1.25rem] border-b-4 border-emerald-500 hover:border-b-2 hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 font-black"
          >
            <NodeIcon className="w-5 h-5" stroke={2.5} />
            {status === LESSON_STATUS.MASTERED ? '¡Repetir!' : '¡Comenzar!'}
          </button>
        </div>
      ) : null}

      {/* Main button */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex justify-center items-center z-10">
        {isMastered ? (
          <IconStar className="absolute -top-2 -right-2 w-8 h-8 text-amber-400 fill-amber-400 animate-pulse z-20 drop-shadow-md" />
        ) : null}

        <button
          onClick={() => {
            if (!isLocked) {
              onSetActive();
            }
          }}
          disabled={isLocked}
          className={`
            relative w-full h-full rounded-[2rem] flex items-center justify-center transition-all outline-none z-10 border-b-[6px]
            ${theme.btn}
            ${
              isActive && !isLocked
                ? 'translate-y-[6px] border-b-0 shadow-none scale-105'
                : isLocked
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:-translate-y-1 active:translate-y-[6px] active:border-b-0 active:shadow-none'
            }
          `}
          aria-label={`Lección: ${lesson.title}`}
          aria-expanded={isActive}
        >
          {isLocked ? (
            <NodeIcon className="w-8 h-8 sm:w-10 sm:h-10" stroke={2.5} />
          ) : (
            <NodeIcon
              className={`w-8 h-8 sm:w-10 sm:h-10 ${
                !isActive ? 'animate-bounce drop-shadow-sm' : ''
              }`}
              stroke={2.5}
            />
          )}
        </button>
      </div>

      {/* Label */}
      <button
        onClick={() => {
          if (!isLocked) {
            onSetActive();
          }
        }}
        disabled={isLocked}
        className={`
          mt-3 w-[115%] sm:w-[125%] px-3 py-2.5 rounded-2xl border-2 flex flex-col items-center justify-center transition-all outline-none z-0
          ${
            isActive && !isLocked
              ? 'bg-sky-50 border-sky-300 shadow-none translate-y-1'
              : isLocked
                ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
                : 'bg-white/90 backdrop-blur-sm border-slate-200/80 shadow-sm hover:border-sky-300 hover:bg-sky-50/80'
          }
        `}
      >
        <div className="h-[2.4rem] flex items-center justify-center w-full px-1">
          <span className="text-xs sm:text-[13px] font-black text-slate-700 tracking-tight text-center leading-[1.15] line-clamp-2 text-balance break-words">
            {lesson.title}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1">
          <span
            className={`text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${
              isActive ? 'text-sky-600' : isLocked ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Lección {lesson.order + 1}
          </span>
        </div>
      </button>
    </div>
  );
}
