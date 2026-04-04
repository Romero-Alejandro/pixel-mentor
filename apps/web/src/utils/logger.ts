/**
 * Conditional logger that only outputs in development mode.
 * Prevents console noise and potential info leaks in production.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log('[PixelMentor]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn('[PixelMentor]', ...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors, but prefix in dev
    if (isDev) {
      console.error('[PixelMentor]', ...args);
    } else {
      console.error(...args);
    }
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug('[PixelMentor]', ...args);
  },
};
