import {
  GAMIFICATION_BADGES,
  GAMIFICATION_LEVELS,
} from '@/features/gamification/domain/gamification-catalog.js';

describe('gamification catalog', () => {
  const codes = GAMIFICATION_BADGES.map((badge) => badge.code);

  it('contains every badge the old hardcoded strategies awarded', () => {
    // Regression guard: the engine used to ask for STREAK_7 / STREAK_30 while
    // the seed only defined STREAK_3, so those badges were silently never
    // awarded. Badges are catalog-driven now, but the codes must stay stable.
    expect(codes).toEqual(expect.arrayContaining(['FIRST_LESSON', 'STREAK_7', 'STREAK_30']));
  });

  it('has unique badge codes', () => {
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has unique level numbers starting at 1 with strictly increasing XP thresholds', () => {
    const levels = GAMIFICATION_LEVELS.map((level) => level.level);
    const minXP = GAMIFICATION_LEVELS.map((level) => level.minXP);

    expect(new Set(levels).size).toBe(levels.length);
    expect(levels).toEqual(levels.slice().sort((a, b) => a - b));
    expect(levels[0]).toBe(1);
    expect(minXP[0]).toBe(0);

    for (let i = 1; i < minXP.length; i++) {
      expect(minXP[i]).toBeGreaterThan(minXP[i - 1]);
    }
  });

  it('only uses requirement types the badge evaluator can interpret', () => {
    const supported = new Set([
      'LESSON_COUNT',
      'STREAK',
      'LEVEL',
      'PERFECT_ATTEMPT',
      'HINT_FREE_PERFECT_LESSONS',
      'HIGH_PARTIAL_CREDIT_LESSONS',
    ]);

    for (const badge of GAMIFICATION_BADGES) {
      expect(supported.has(badge.rules.type)).toBe(true);
      expect(badge.rules.value).toBeGreaterThan(0);
      expect(badge.xpReward).toBeGreaterThanOrEqual(0);
    }
  });
});
