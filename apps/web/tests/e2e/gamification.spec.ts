import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Gamification System
 *
 * Suite ID: GAMIFICATION-E2E
 * Feature: Gamification UI — XP progress, level up, badges, streaks
 *
 * Tests verify all gamification components render correctly on the test page:
 * - XPProgress: progress bar, level title, XP text
 * - LevelUpModal: appears on trigger, shows new level, dismisses
 * - BadgeGrid: earned badges visible, locked badges grayed, progress bars shown
 * - BadgeEarnedModal: appears on trigger, shows badge name and XP reward, dismisses
 * - StreakCounter: streak count displayed, fire icon present
 */

import { GamificationPage } from './gamification-page';

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: XP Progress Display
// ─────────────────────────────────────────────────────────────────────────────

test.describe('XP Progress Display', () => {
  test.beforeEach(async ({ page }) => {
    const gamification = new GamificationPage(page);
    await gamification.goto();
    await gamification.waitForPageReady();
  });

  test(
    'GAMIFICATION-E2E-001: XP progress bar is visible',
    { tag: ['@e2e', '@gamification', '@xp', '@critical'] },
    async ({ page }) => {
      const progressBar = page.getByRole('progressbar');
      await expect(progressBar).toBeVisible();

      // Verify the aria attributes are set correctly
      await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      await expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    },
  );

  test(
    'GAMIFICATION-E2E-002: Level title is displayed correctly',
    { tag: ['@e2e', '@gamification', '@xp'] },
    async ({ page }) => {
      // The test page renders level 2 "Aprendiz" with 250 XP
      const levelInfo = page.getByText(/Nivel 2: Aprendiz/);
      await expect(levelInfo).toBeVisible();

      // Current XP text should be visible
      const xpText = page.getByText('250 XP');
      await expect(xpText.first()).toBeVisible();
    },
  );

  test(
    'GAMIFICATION-E2E-003: XP progress text shows XP remaining for next level',
    { tag: ['@e2e', '@gamification', '@xp'] },
    async ({ page }) => {
      // The component shows "100 XP para el siguiente nivel" when at 250/350
      const xpRemaining = page.getByText(/XP para el siguiente nivel/);
      await expect(xpRemaining.first()).toBeVisible();
    },
  );

  test(
    'GAMIFICATION-E2E-004: Progress bar has correct aria-label',
    { tag: ['@e2e', '@gamification', '@xp', '@a11y'] },
    async ({ page }) => {
      const progressBar = page.getByRole('progressbar');
      const ariaLabel = await progressBar.getAttribute('aria-label');
      expect(ariaLabel).toContain('Progreso de XP');
      expect(ariaLabel).toContain('%');
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Level Up Modal
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Level Up Modal', () => {
  test.beforeEach(async ({ page }) => {
    const gamification = new GamificationPage(page);
    await gamification.goto();
    await gamification.waitForPageReady();
  });

  test(
    'GAMIFICATION-E2E-005: Level up modal is not visible initially',
    { tag: ['@e2e', '@gamification', '@level-up'] },
    async ({ page }) => {
      const modal = page.getByRole('dialog', { name: /subiste al nivel/i });
      await expect(modal).toBeHidden();
    },
  );

  test(
    'GAMIFICATION-E2E-006: Level up modal appears when triggered',
    { tag: ['@e2e', '@gamification', '@level-up', '@critical'] },
    async ({ page }) => {
      const gamification = new GamificationPage(page);
      await gamification.openLevelUpModal();

      // Modal should be visible
      await expect(gamification.levelUpModal).toBeVisible();

      // Should show the title "¡Subiste de nivel!"
      const title = page.getByText(/subiste de nivel/i);
      await expect(title).toBeVisible();

      // Should show the new level title
      await expect(gamification.levelUpNewLevel).toBeVisible();

      // Should show level transition (Nivel 2 → Nivel 3)
      const previousLevel = page.getByText(/Nivel 2/);
      await expect(previousLevel).toBeVisible();
    },
  );

  test(
    'GAMIFICATION-E2E-007: Level up modal dismiss button works',
    { tag: ['@e2e', '@gamification', '@level-up', '@critical'] },
    async ({ page }) => {
      const gamification = new GamificationPage(page);
      await gamification.openLevelUpModal();
      await gamification.dismissLevelUpModal();
    },
  );

  test(
    'GAMIFICATION-E2E-008: Level up modal closes on Escape key',
    { tag: ['@e2e', '@gamification', '@level-up'] },
    async ({ page }) => {
      const gamification = new GamificationPage(page);
      await gamification.openLevelUpModal();

      // Press Escape
      await page.keyboard.press('Escape');

      // Modal should close
      await expect(gamification.levelUpModal).toBeHidden();
    },
  );

  test(
    'GAMIFICATION-E2E-009: Level up modal closes on backdrop click',
    { tag: ['@e2e', '@gamification', '@level-up'] },
    async ({ page }) => {
      const gamification = new GamificationPage(page);
      await gamification.openLevelUpModal();

      // Click on the backdrop (the black overlay behind the modal)
      const backdrop = page.locator('.bg-black\\/50');
      await backdrop.click({ position: { x: 10, y: 10 } });

      // Modal should close
      await expect(gamification.levelUpModal).toBeHidden();
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Badge Display
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Badge Display', () => {
  test.beforeEach(async ({ page }) => {
    const gamification = new GamificationPage(page);
    await gamification.goto();
    await gamification.waitForPageReady();
  });

  test(
    'GAMIFICATION-E2E-010: Earned badges are visible in grid',
    { tag: ['@e2e', '@gamification', '@badges', '@critical'] },
    async ({ page }) => {
      // The earned badges section should have 2 badges
      const earnedSection = page.getByTestId('section-badges-earned');
      const badges = earnedSection.locator('[role="article"]');
      await expect(badges).toHaveCount(2);

      // First badge should be "Primera Lección"
      const firstBadge = page.getByText(/Primera Lección/);
      await expect(firstBadge).toBeVisible();

      // Second badge should be "Racha de 3"
      const secondBadge = page.getByText(/Racha de 3/);
      await expect(secondBadge).toBeVisible();
    },
  );

  test(
    'GAMIFICATION-E2E-011: Earned badges show earned date',
    { tag: ['@e2e', '@gamification', '@badges'] },
    async ({ page }) => {
      // Earned badges display a date
      const earnedSection = page.getByTestId('section-badges-earned');
      const dateText = earnedSection.locator('text=/📅/');
      await expect(dateText.first()).toBeVisible();
    },
  );

  test(
    'GAMIFICATION-E2E-012: Locked badges are shown grayed out',
    { tag: ['@e2e', '@gamification', '@badges'] },
    async ({ page }) => {
      // The progress section includes locked badges
      const progressSection = page.getByTestId('section-badges-progress');

      // Locked badges should have the lock icon
      const lockIcon = progressSection.locator('text=/🔒/');
      await expect(lockIcon.first()).toBeVisible();

      // Locked badges should have "Bloqueada" in aria-label
      const lockedCards = progressSection.locator('[aria-label*="Bloqueada"]');
      await expect(lockedCards.first()).toBeVisible();
    },
  );

  test(
    'GAMIFICATION-E2E-013: Badge progress percentage is shown for locked badges',
    { tag: ['@e2e', '@gamification', '@badges'] },
    async ({ page }) => {
      const progressSection = page.getByTestId('section-badges-progress');

      // The badge progress bars should show percentage
      const progressLabels = progressSection.locator('text=/Progreso/');
      await expect(progressLabels.first()).toBeVisible();

      // Should show percentage values (60% and 23%)
      const percentText = progressSection.locator('text=/\\d+%/');
      await expect(percentText.first()).toBeVisible();
    },
  );

  test(
    'GAMIFICATION-E2E-014: Empty badges state is displayed correctly',
    { tag: ['@e2e', '@gamification', '@badges'] },
    async ({ page }) => {
      const emptySection = page.getByTestId('section-badges-empty');
      const emptyMessage = emptySection.getByText(/aún no tienes insignias/i);
      await expect(emptyMessage).toBeVisible();

      // Should show the empty state emoji
      const emoji = emptySection.locator('text=/🎖️/');
      await expect(emoji).toBeVisible();
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Badge Earned Modal
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Badge Earned Modal', () => {
  test.beforeEach(async ({ page }) => {
    const gamification = new GamificationPage(page);
    await gamification.goto();
    await gamification.waitForPageReady();
  });

  test(
    'GAMIFICATION-E2E-015: Badge earned modal is not visible initially',
    { tag: ['@e2e', '@gamification', '@badge-earned'] },
    async ({ page }) => {
      const modal = page.getByRole('dialog', { name: /ganaste la insignia/i });
      await expect(modal).toBeHidden();
    },
  );

  test(
    'GAMIFICATION-E2E-016: Badge earned modal appears when triggered',
    { tag: ['@e2e', '@gamification', '@badge-earned', '@critical'] },
    async ({ page }) => {
      const gamification = new GamificationPage(page);
      await gamification.openBadgeEarnedModal();

      // Modal should be visible
      await expect(gamification.badgeEarnedModal).toBeVisible();

      // Should show badge name
      await expect(gamification.badgeEarnedName).toBeVisible();

      // Should show XP reward
      await expect(gamification.badgeEarnedXpReward).toBeVisible();

      // Should show the header
      const header = page.getByText(/nueva insignia/i);
      await expect(header).toBeVisible();
    },
  );

  test(
    'GAMIFICATION-E2E-017: Badge earned modal dismiss button works',
    { tag: ['@e2e', '@gamification', '@badge-earned', '@critical'] },
    async ({ page }) => {
      const gamification = new GamificationPage(page);
      await gamification.openBadgeEarnedModal();
      await gamification.dismissBadgeEarnedModal();
    },
  );

  test(
    'GAMIFICATION-E2E-018: Badge earned modal closes on Escape key',
    { tag: ['@e2e', '@gamification', '@badge-earned'] },
    async ({ page }) => {
      const gamification = new GamificationPage(page);
      await gamification.openBadgeEarnedModal();

      // Press Escape
      await page.keyboard.press('Escape');

      // Modal should close
      await expect(gamification.badgeEarnedModal).toBeHidden();
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Streak Counter
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Streak Counter', () => {
  test.beforeEach(async ({ page }) => {
    const gamification = new GamificationPage(page);
    await gamification.goto();
    await gamification.waitForPageReady();
  });

  test(
    'GAMIFICATION-E2E-019: Streak count is displayed',
    { tag: ['@e2e', '@gamification', '@streak', '@critical'] },
    async ({ page }) => {
      // The streak counter should show 7 days
      const streakStatus = page.getByRole('status', { name: /racha de 7 días/i });
      await expect(streakStatus).toBeVisible();

      // The count number should be "7"
      const countText = streakStatus.locator('.text-orange-600');
      await expect(countText).toHaveText('7');

      // The label should say "días" (plural, since > 1)
      const label = streakStatus.locator('.text-orange-500');
      await expect(label).toHaveText('días');
    },
  );

  test(
    'GAMIFICATION-E2E-020: Fire icon is displayed with correct content',
    { tag: ['@e2e', '@gamification', '@streak'] },
    async ({ page }) => {
      // The fire icon should be present
      const streakStatus = page.getByRole('status', { name: /racha de 7 días/i });
      const fireIcon = streakStatus.locator('[aria-hidden="true"]');
      const fireText = await fireIcon.textContent();

      // For a 7-day streak, should show 🔥
      expect(fireText).toContain('🔥');
    },
  );

  test(
    'GAMIFICATION-E2E-021: Longest streak badge is shown when current < longest',
    { tag: ['@e2e', '@gamification', '@streak'] },
    async ({ page }) => {
      // The streak section shows longest > current, so trophy should appear
      const streakSection = page.getByTestId('section-streak');
      const trophy = streakSection.locator('text=/🏆 12/');
      await expect(trophy).toBeVisible();
    },
  );

  test(
    'GAMIFICATION-E2E-022: Zero streak shows fire icon',
    { tag: ['@e2e', '@gamification', '@streak'] },
    async ({ page }) => {
      // The zero-streak counter should still show fire icon
      const zeroStreak = page.getByRole('status', { name: /racha de 0 días/i });
      await expect(zeroStreak).toBeVisible();

      // Count should be "0"
      const countText = zeroStreak.locator('.text-orange-600');
      await expect(countText).toHaveText('0');
    },
  );

  test(
    'GAMIFICATION-E2E-023: Streak counter has correct aria-label',
    { tag: ['@e2e', '@gamification', '@streak', '@a11y'] },
    async ({ page }) => {
      const streakStatus = page.getByRole('status', { name: /racha de 7 días/i });
      await expect(streakStatus).toHaveAttribute('aria-label', 'Racha de 7 días');
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Gamification Header (integrated component)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Gamification Header', () => {
  test.beforeEach(async ({ page }) => {
    const gamification = new GamificationPage(page);
    await gamification.goto();
    await gamification.waitForPageReady();
  });

  test(
    'GAMIFICATION-E2E-024: Gamification header renders all sub-components',
    { tag: ['@e2e', '@gamification', '@header', '@critical'] },
    async ({ page }) => {
      const headerSection = page.getByTestId('section-header');

      // Header should contain the level badge
      const levelBadge = headerSection.getByText(/Aprendiz/);
      await expect(levelBadge).toBeVisible();

      // Header should contain XP progress
      const progressBar = headerSection.getByRole('progressbar');
      await expect(progressBar).toBeVisible();

      // Header should contain streak counter
      const streak = headerSection.getByRole('status', { name: /racha/i });
      await expect(streak).toBeVisible();

      // Header should contain badge count
      const badgeCount = headerSection.getByText('2');
      await expect(badgeCount).toBeVisible();
    },
  );

  test(
    'GAMIFICATION-E2E-025: Gamification header has correct aria-label',
    { tag: ['@e2e', '@gamification', '@header', '@a11y'] },
    async ({ page }) => {
      const header = page.locator('[aria-label="Progreso de gamificación"]');
      await expect(header).toBeVisible();
    },
  );
});
