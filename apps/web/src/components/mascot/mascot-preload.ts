import rivUrl from '@/assets/magic-cat.riv?url';

let warmed = false;

/**
 * Warms everything the lesson mascot needs while the user is elsewhere
 * (dashboard, login): the Rive component chunk and the 4.4MB scene bytes.
 * Safe to call repeatedly and to cancel by navigating away — all work is
 * best-effort cache warming. Call it from an idle callback, never on the
 * critical path.
 */
export function preloadMascot(): void {
  if (warmed) return;
  warmed = true;
  // Component + Rive runtime chunk (same chunk React.lazy loads later).
  void import('./Mascot').catch(() => {
    warmed = false;
  });
  // Scene bytes into the HTTP cache.
  void fetch(rivUrl).catch(() => {
    // Best effort: LessonPage loads it on demand if warming failed.
  });
}
