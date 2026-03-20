import { useState } from 'react';
import { IconTrophy, IconLock, IconX, IconStar, IconTargetArrow } from '@tabler/icons-react';
import { type EarnedBadge, type BadgeInfo } from '@pixel-mentor/shared/gamification';

interface BadgeGridProps {
  allBadges: BadgeInfo[];
  earnedBadges: EarnedBadge[];
}

function getRequirementText(req: BadgeInfo['requirement']): string {
  if (!req) return 'Misión misteriosa';
  if (typeof req === 'string') return req;

  const target = 'target' in req ? req.target : 0;

  switch (req.type) {
    case 'LESSON_COUNT':
      return `Completa ${target} lecciones`;
    case 'STREAK':
      return `Mantén una racha de ${target} días`;
    case 'LEVEL':
      return `Alcanza el nivel ${target}`;
    case 'PERFECT_ATTEMPT':
      return `Obtén ${target} lecciones perfectas`;
    default:
      return 'Sigue aprendiendo para descubrirlo';
  }
}

export function BadgeGrid({ allBadges, earnedBadges }: BadgeGridProps) {
  const [selectedBadge, setSelectedBadge] = useState<BadgeInfo | null>(null);

  return (
    <>
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2"
        role="list"
        aria-label="Cuadrícula de medallas"
      >
        {allBadges.map((badge) => {
          const badgeId: string =
            'id' in badge && typeof badge.id === 'string' ? badge.id : badge.code;

          const earnedInfo = earnedBadges.find((b) => {
            const eId = 'badgeId' in b ? b.badgeId : b.code;
            return eId === badgeId;
          });

          const isEarned = !!earnedInfo;

          return (
            <button
              key={badgeId}
              onClick={() => setSelectedBadge(badge)}
              aria-label={`${badge.name}. ${isEarned ? 'Desbloqueada' : 'Bloqueada'}`}
              className={`
                relative flex flex-col items-center justify-center p-4 rounded-3xl border-4 transition-all duration-200 outline-none
                ${
                  isEarned
                    ? 'bg-amber-50 border-amber-300 shadow-[0_4px_0_0_#fcd34d] hover:-translate-y-1 hover:shadow-[0_6px_0_0_#fcd34d] active:translate-y-1 active:shadow-none cursor-pointer'
                    : 'bg-slate-50 border-slate-200 opacity-70 hover:opacity-100 hover:-translate-y-1 cursor-pointer'
                }
              `}
            >
              <div
                className={`
                  w-16 h-16 rounded-full flex items-center justify-center mb-3 border-4
                  ${isEarned ? 'bg-white border-amber-200 text-amber-500' : 'bg-slate-100 border-slate-200 text-slate-400'}
                `}
                aria-hidden="true"
              >
                {isEarned ? (
                  <IconTrophy className="w-8 h-8" stroke={2.5} />
                ) : (
                  <IconLock className="w-8 h-8" stroke={2.5} />
                )}
              </div>

              <h3
                className={`text-sm font-black text-center leading-tight ${isEarned ? 'text-amber-800' : 'text-slate-500'}`}
              >
                {badge.name}
              </h3>

              {isEarned && earnedInfo?.xpReward ? (
                <div
                  className="absolute -top-3 -right-3 bg-emerald-400 text-white text-[10px] font-black px-2 py-1 rounded-full border-2 border-emerald-500 shadow-sm flex items-center gap-1 animate-bounce-in"
                  aria-label={`Recompensa: ${earnedInfo.xpReward} puntos de experiencia`}
                >
                  <IconStar className="w-3 h-3 fill-current" aria-hidden="true" />+
                  {earnedInfo.xpReward}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {selectedBadge ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedBadge(null)}
            role="button"
            tabIndex={0}
            aria-label="Cerrar detalles de la medalla"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setSelectedBadge(null);
            }}
          />
          <div className="relative bg-white border-4 border-sky-300 shadow-[0_8px_0_0_#7dd3fc] rounded-[2rem] p-8 max-w-sm w-full animate-bounce-in flex flex-col items-center text-center z-10">
            <button
              onClick={() => setSelectedBadge(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded-full flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <IconX className="w-5 h-5" stroke={3} aria-hidden="true" />
            </button>

            <div
              className="w-24 h-24 bg-sky-50 border-4 border-sky-200 rounded-full flex items-center justify-center text-sky-500 mb-6"
              aria-hidden="true"
            >
              {earnedBadges.some((b) => {
                const eId = 'badgeId' in b ? b.badgeId : b.code;
                const sId = 'id' in selectedBadge ? selectedBadge.id : selectedBadge.code;
                return eId === sId;
              }) ? (
                <IconTrophy className="w-12 h-12" stroke={2.5} />
              ) : (
                <IconLock className="w-12 h-12" stroke={2.5} />
              )}
            </div>

            <h2 className="text-2xl font-black text-slate-800 mb-2">{selectedBadge.name}</h2>
            <p className="text-slate-600 font-medium mb-6">{selectedBadge.description}</p>

            <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 flex items-start gap-3 text-left">
              <IconTargetArrow
                className="w-6 h-6 text-sky-500 shrink-0"
                stroke={2.5}
                aria-hidden="true"
              />
              <div>
                <span className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                  Misión para desbloquear
                </span>
                <span className="text-sm font-bold text-slate-700">
                  {getRequirementText(selectedBadge.requirement)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
