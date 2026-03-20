import { useState, useCallback, useRef } from 'react';

interface Particle {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly tx: number;
  readonly ty: number;
  readonly delay: number;
}

const XP_COUNTER_SELECTOR = '[data-xp-counter]';

function resolveTarget(element: HTMLElement | null): { x: number; y: number } {
  if (!element) {
    return { x: window.innerWidth / 2, y: 24 };
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function resolveOrigin(element: HTMLElement | null): { x: number; y: number } {
  if (!element) {
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.7 };
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top,
  };
}

export interface UseXPParticlesResult {
  readonly particles: readonly Particle[];
  triggerParticles(originElement: HTMLElement | null, targetElement?: HTMLElement | null): void;
}

export function useXPParticles(): UseXPParticlesResult {
  const [particles, setParticles] = useState<readonly Particle[]>([]);
  const idCounterRef = useRef(0);

  const triggerParticles = useCallback(
    (originElement: HTMLElement | null, targetElement?: HTMLElement | null) => {
      const resolvedTarget = resolveTarget(
        targetElement ?? document.querySelector<HTMLElement>(XP_COUNTER_SELECTOR),
      );
      const resolvedOrigin = resolveOrigin(originElement);

      const count = 3 + Math.floor(Math.random() * 3); // 3-5 particles
      const now = Date.now();

      const newParticles: Particle[] = Array.from({ length: count }, () => {
        const id = idCounterRef.current++;
        const spreadX = (Math.random() - 0.5) * 60;
        const spreadY = (Math.random() - 0.5) * 30;
        const delay = Math.random() * 200;

        return {
          id,
          x: resolvedOrigin.x + spreadX,
          y: resolvedOrigin.y + spreadY,
          tx: resolvedTarget.x + (Math.random() - 0.5) * 20,
          ty: resolvedTarget.y,
          delay,
        };
      });

      setParticles((prev) => [...prev, ...newParticles]);

      // Auto-cleanup after animation completes (1.2s + max delay + buffer)
      const cleanupAt = now + 1200 + 200 + 100;
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !newParticles.includes(p)));
      }, cleanupAt - now);
    },
    [],
  );

  return { particles, triggerParticles };
}
