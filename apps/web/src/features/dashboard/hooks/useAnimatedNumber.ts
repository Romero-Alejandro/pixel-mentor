import { useState, useEffect } from 'react';

export function useAnimatedNumber(target: number, durationMs: number = 1500, delayMs: number = 0) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (target === 0) return;

    const timeoutId = setTimeout(() => {
      const startTime = Date.now();
      const intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        // Función de easing (ease-out cubic) para que frene suave al final
        const easeOut = 1 - Math.pow(1 - progress, 3);

        setCurrent(Math.floor(easeOut * target));

        if (progress === 1) clearInterval(intervalId);
      }, 16); // ~60fps

      return () => clearInterval(intervalId);
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [target, durationMs, delayMs]);

  return current;
}
