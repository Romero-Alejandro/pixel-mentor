/**
 * GamificationTestPage — renders all gamification components for E2E testing.
 *
 * This page is only used by Playwright E2E tests to verify gamification UI.
 * It mounts XPProgress, LevelUpModal, BadgeGrid, BadgeEarnedModal, and StreakCounter
 * with deterministic test data so Playwright can assert on DOM structure.
 */
import { useState } from 'react';
import type {
  UserGamificationProfile,
  EarnedBadge,
  BadgeProgress,
  LevelUpInfo,
} from '@pixel-mentor/shared/gamification';

import { GamificationHeader } from '@/features/gamification/components/GamificationHeader';
import { XPProgress } from '@/features/gamification/components/XPProgress';
import { LevelUpModal } from '@/features/gamification/components/LevelUpModal';
import { BadgeGrid } from '@/features/gamification/components/BadgeGrid';
import { BadgeEarnedModal } from '@/features/gamification/components/BadgeEarnedModal';
import { StreakCounter } from '@/features/gamification/components/StreakCounter';

// ─── Test Data ────────────────────────────────────────────────────────────────

const testProfile: UserGamificationProfile = {
  userId: 'test-user-1',
  totalXP: 250,
  currentLevel: 2,
  currentStreak: 7,
  longestStreak: 12,
  levelTitle: 'Aprendiz',
  xpToNextLevel: 350,
  badges: [
    {
      code: 'first_lesson',
      name: 'Primera Lección',
      description: 'Completaste tu primera lección',
      icon: '🎯',
      earnedAt: '2026-03-15T10:00:00.000Z',
      xpReward: 10,
    },
    {
      code: 'streak_3',
      name: 'Racha de 3',
      description: 'Mantuviste una racha de 3 días',
      icon: '🔥',
      earnedAt: '2026-03-17T10:00:00.000Z',
      xpReward: 25,
    },
  ],
};

const testLevelUp: LevelUpInfo = {
  userId: 'test-user-1',
  newLevel: 3,
  newLevelTitle: 'Explorador',
  previousLevel: 2,
  totalXP: 500,
};

const testBadgeEarned: EarnedBadge = {
  code: 'perfect_score',
  name: 'Puntuación Perfecta',
  description: 'Obtuviste 100% en una actividad',
  icon: '🏆',
  earnedAt: '2026-03-20T12:00:00.000Z',
  xpReward: 50,
};

const testBadgeProgress: BadgeProgress[] = [
  {
    badge: {
      code: 'lessons_10',
      name: 'Estudiante Dedicado',
      description: 'Completa 10 lecciones',
      icon: '📚',
      xpReward: 100,
      requirement: { type: 'LESSON_COUNT', target: 10 },
    },
    current: 6,
    target: 10,
    percentage: 60,
    isEarned: false,
  },
  {
    badge: {
      code: 'streak_30',
      name: 'Imparable',
      description: 'Mantén una racha de 30 días',
      icon: '⚡',
      xpReward: 200,
      requirement: { type: 'STREAK', target: 30 },
    },
    current: 7,
    target: 30,
    percentage: 23.33,
    isEarned: false,
  },
];

// ─── Page Component ───────────────────────────────────────────────────────────

export function GamificationTestPage() {
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showBadgeEarned, setShowBadgeEarned] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 p-8 space-y-8">
      <h1 className="text-2xl font-bold text-slate-800" data-testid="page-title">
        Gamification Test Page
      </h1>

      {/* Section: Gamification Header */}
      <section data-testid="section-header">
        <h2 className="text-lg font-semibold text-slate-600 mb-4">Gamification Header</h2>
        <GamificationHeader profile={testProfile} />
      </section>

      {/* Section: XP Progress (standalone) */}
      <section data-testid="section-xp-progress">
        <h2 className="text-lg font-semibold text-slate-600 mb-4">XP Progress</h2>
        <XPProgress
          currentXP={testProfile.totalXP}
          xpToNextLevel={testProfile.xpToNextLevel}
          level={testProfile.currentLevel}
          levelTitle={testProfile.levelTitle}
        />
      </section>

      {/* Section: Streak Counter */}
      <section data-testid="section-streak">
        <h2 className="text-lg font-semibold text-slate-600 mb-4">Streak Counter</h2>
        <div className="flex items-center gap-8">
          <div>
            <p className="text-sm text-slate-500 mb-2">Active streak (7 days)</p>
            <StreakCounter
              streak={testProfile.currentStreak}
              longestStreak={testProfile.longestStreak}
              size="md"
            />
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-2">No streak (0 days)</p>
            <StreakCounter streak={0} size="md" />
          </div>
        </div>
      </section>

      {/* Section: Badge Grid — earned badges */}
      <section data-testid="section-badges-earned">
        <h2 className="text-lg font-semibold text-slate-600 mb-4">Earned Badges</h2>
        <BadgeGrid badges={testProfile.badges} showProgress={false} />
      </section>

      {/* Section: Badge Grid — with progress (earned + unearned) */}
      <section data-testid="section-badges-progress">
        <h2 className="text-lg font-semibold text-slate-600 mb-4">Badge Progress</h2>
        <BadgeGrid badges={[...testProfile.badges, ...testBadgeProgress]} showProgress={true} />
      </section>

      {/* Section: Badge Grid — empty state */}
      <section data-testid="section-badges-empty">
        <h2 className="text-lg font-semibold text-slate-600 mb-4">Empty Badges</h2>
        <BadgeGrid badges={[]} showProgress={false} />
      </section>

      {/* Section: Modal triggers */}
      <section data-testid="section-modals" className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-600 mb-4">Modals</h2>
        <div className="flex gap-4">
          <button
            data-testid="open-level-up"
            onClick={() => setShowLevelUp(true)}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600"
          >
            Show Level Up Modal
          </button>
          <button
            data-testid="open-badge-earned"
            onClick={() => setShowBadgeEarned(true)}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600"
          >
            Show Badge Earned Modal
          </button>
        </div>
      </section>

      {/* Modals */}
      <LevelUpModal
        levelUp={testLevelUp}
        isOpen={showLevelUp}
        onClose={() => setShowLevelUp(false)}
      />
      <BadgeEarnedModal
        badge={testBadgeEarned}
        isOpen={showBadgeEarned}
        onClose={() => setShowBadgeEarned(false)}
      />
    </div>
  );
}
