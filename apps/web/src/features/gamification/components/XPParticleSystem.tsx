import { useEffect } from 'react';
import type { RefObject } from 'react';

import { useGamificationStore } from '../stores/gamification.store';

import { XPParticle } from './XPParticle';
import { useXPParticles } from './useXPParticles';

const XP_COUNTER_SELECTOR = '[data-xp-counter]';

export interface XPParticleSystemProps {
  readonly originRef?: RefObject<HTMLElement | null>;
}

export function XPParticleSystem({ originRef }: XPParticleSystemProps) {
  const { particles, triggerParticles } = useXPParticles();
  const xpEarned = useGamificationStore((s) => s.xpEarned);
  const clearXPEarned = useGamificationStore((s) => s.clearXPEarned);

  useEffect(() => {
    if (xpEarned === null) return;

    const targetElement = document.querySelector<HTMLElement>(XP_COUNTER_SELECTOR);
    const originElement = originRef?.current ?? null;
    triggerParticles(originElement, targetElement);
    clearXPEarned();
  }, [xpEarned, triggerParticles, clearXPEarned, originRef]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50" aria-hidden="true">
      {particles.map((p) => (
        <XPParticle key={p.id} x={p.x} y={p.y} tx={p.tx} ty={p.ty} delay={p.delay} />
      ))}
    </div>
  );
}
