import { useState } from 'react';
import { IconCloud, IconSchool } from '@tabler/icons-react';

import { buildClassTiers } from '../utils/classContext.util';

import { MissionNode } from './MissionNode';

import type { Class, Session } from '@/services/api';

interface MissionMapProps {
  classes: Class[];
  sessions: Session[];
  onInteract: () => void;
}

export function MissionMap({ classes = [], sessions = [], onInteract }: MissionMapProps) {
  const tiers = buildClassTiers(classes, sessions);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

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

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-bounce-in">
        <div className="w-24 h-24 bg-sky-100 rounded-[2rem] flex items-center justify-center mb-6 border-4 border-sky-200 shadow-sm">
          <IconSchool className="w-12 h-12 text-sky-400" stroke={2.5} />
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-3">Aventura no iniciada</h3>
        <p className="text-slate-500 font-bold text-lg max-w-sm">
          Tu profesor aún no ha publicado clases. ¡Vuelve pronto!
        </p>
      </div>
    );
  }

  return (
    <div className="relative pt-24 pb-28 flex flex-col items-center w-full max-w-md mx-auto overflow-visible">
      <IconCloud
        className="absolute top-12 left-4 w-16 h-16 text-sky-100/80 animate-[pulse_4s_ease-in-out_infinite] pointer-events-none"
        fill="currentColor"
        stroke={0}
      />
      <IconCloud
        className="absolute top-1/4 right-0 w-24 h-24 text-sky-200/40 animate-[bounce_6s_ease-in-out_infinite] pointer-events-none"
        fill="currentColor"
        stroke={0}
      />

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

      <div className="flex flex-col gap-12 sm:gap-20 w-full relative">
        {tiers.map((tier, tIdx) => {
          const isMultiNode = tier.classes.length > 1;
          const alignmentClass = isMultiNode ? 'justify-center gap-6 sm:gap-12' : 'justify-center';
          const offsetClass = isMultiNode ? 'translate-x-0' : getOffsetClass(tIdx);

          const isActiveRow = tier.classes.some((r) => r.classItem.id === activeNodeId);
          const zIndexClass = isActiveRow ? 'z-50' : 'z-10';

          return (
            <div
              key={tier.tierId}
              className={`flex w-full px-4 ${alignmentClass} ${offsetClass} ${zIndexClass} relative transition-transform duration-500 animate-in fade-in slide-in-from-bottom-8`}
              style={{ animationDelay: `${tIdx * 150}ms`, animationFillMode: 'both' }}
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

      <div className="w-64 sm:w-80 h-20 bg-emerald-200/40 blur-2xl rounded-[100%] absolute bottom-0 z-0 pointer-events-none" />
    </div>
  );
}
