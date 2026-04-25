import { useState } from 'react';
import { IconCloud, IconSchool, IconStarFilled, IconSparkles } from '@tabler/icons-react';

import { buildClassTiers } from '../utils/classContext.util';
import { MissionNode } from './MissionNode';
import type { Class, Session } from '@/services/api';

const ANIMATION_STAGGER_DELAY_MS = 150;

interface MissionMapProps {
  classes: Class[];
  sessions: Session[];
  onInteract: () => void;
}

export function MissionMap({ classes = [], sessions = [], onInteract }: MissionMapProps) {
  const tiers = buildClassTiers(classes, sessions);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Ampliamos el zig-zag para aprovechar pantallas grandes (tablet/desktop)
  const getOffsetClass = (index: number) => {
    const cycle = index % 4;
    switch (cycle) {
      case 0:
        return 'translate-x-0';
      case 1:
        return '-translate-x-16 sm:-translate-x-24 md:-translate-x-32';
      case 2:
        return 'translate-x-0';
      case 3:
        return 'translate-x-16 sm:translate-x-24 md:translate-x-32';
      default:
        return 'translate-x-0';
    }
  };

  // Estado vacío gamificado y motivador
  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] py-16 text-center animate-in zoom-in-95 duration-500">
        <div className="relative w-32 h-32 bg-sky-50 rounded-[3rem] flex items-center justify-center mb-6 border-4 border-sky-200 shadow-[0_8px_0_0_#bae6fd]">
          <IconSparkles className="absolute -top-4 -right-4 w-10 h-10 text-amber-400 animate-pulse" />
          <IconSchool className="w-16 h-16 text-sky-400" stroke={2.5} />
        </div>
        <h3 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">
          ¡Preparando el mapa!
        </h3>
        <p className="text-slate-500 font-bold text-lg max-w-sm leading-relaxed">
          Tu profesor está escondiendo nuevas misiones y tesoros. ¡Vuelve muy pronto para empezar tu
          aventura!
        </p>
      </div>
    );
  }

  return (
    <div className="relative pt-32 pb-36 flex flex-col items-center w-full max-w-2xl mx-auto overflow-visible min-h-[80vh]">
      {/* Decoraciones de fondo ambientales */}
      <IconCloud
        className="absolute top-12 left-4 sm:left-10 w-20 h-20 text-sky-100 animate-[pulse_4s_ease-in-out_infinite] pointer-events-none"
        fill="currentColor"
        stroke={0}
      />
      <IconCloud
        className="absolute top-1/3 right-4 sm:right-12 w-28 h-28 text-sky-200/50 animate-[bounce_6s_ease-in-out_infinite] pointer-events-none"
        fill="currentColor"
        stroke={0}
      />
      <IconCloud
        className="absolute bottom-1/4 left-8 w-16 h-16 text-sky-100 animate-[pulse_5s_ease-in-out_infinite] pointer-events-none"
        fill="currentColor"
        stroke={0}
      />

      <IconStarFilled className="absolute top-1/4 left-1/4 w-6 h-6 text-amber-200 animate-ping pointer-events-none opacity-60" />
      <IconStarFilled className="absolute bottom-1/3 right-1/4 w-8 h-8 text-amber-200 animate-pulse pointer-events-none opacity-60" />

      {/* Brillo central de fondo */}
      <div className="absolute top-12 bottom-12 left-1/2 -translate-x-1/2 w-28 sm:w-40 bg-sky-50/60 rounded-full z-0 shadow-[inset_0_0_30px_rgba(186,230,253,0.6)] border-x-4 border-sky-100/30 backdrop-blur-sm pointer-events-none" />

      {/* Camino central grueso y amigable */}
      <div
        className="absolute inset-0 w-full h-full z-0 pointer-events-none flex justify-center opacity-70"
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 2%, black 10%, black 90%, transparent 98%)',
        }}
      >
        <svg className="w-6 sm:w-8 h-full" preserveAspectRatio="none">
          <line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke="#bae6fd"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="0 32"
          />
        </svg>
      </div>

      {/* Nodos de Misión */}
      <div className="flex flex-col gap-16 sm:gap-24 w-full relative z-10">
        {tiers.map((tier, tIdx) => {
          const isMultiNode = tier.classes.length > 1;
          const alignmentClass = isMultiNode ? 'justify-center gap-8 sm:gap-16' : 'justify-center';
          const offsetClass = isMultiNode ? 'translate-x-0' : getOffsetClass(tIdx);
          const isActiveRow = tier.classes.some((r) => r.classItem.id === activeNodeId);
          const zIndexClass = isActiveRow ? 'z-50' : 'z-10';

          return (
            <div
              key={tier.tierId}
              className={`flex w-full px-4 ${alignmentClass} ${offsetClass} ${zIndexClass} relative transition-transform duration-700 ease-out animate-in fade-in slide-in-from-bottom-8`}
              style={{
                animationDelay: `${tIdx * ANIMATION_STAGGER_DELAY_MS}ms`,
                animationFillMode: 'both',
              }}
            >
              {tier.classes.map(({ classItem, context }) => (
                <MissionNode
                  key={classItem.id}
                  classItem={classItem}
                  context={context}
                  onInteract={onInteract}
                  isActive={activeNodeId === classItem.id}
                  onSetActive={() =>
                    setActiveNodeId(activeNodeId === classItem.id ? null : classItem.id)
                  }
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="w-72 sm:w-96 h-24 bg-emerald-200/30 blur-3xl rounded-[100%] absolute bottom-0 z-0 pointer-events-none" />
    </div>
  );
}
