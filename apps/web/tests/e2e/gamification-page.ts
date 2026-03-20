import { type Page, type Locator, expect } from '@playwright/test';

import { BasePage } from '../../../../../tests/base-page';

/**
 * Page Object for the Gamification Test Page.
 *
 * Provides locators and helpers for all gamification components:
 * - XPProgress bar and level info
 * - LevelUpModal
 * - BadgeGrid / BadgeCard (earned and locked)
 * - BadgeEarnedModal
 * - StreakCounter
 */
export class GamificationPage extends BasePage {
  // ─── XP Progress ─────────────────────────────────────────────────────────

  readonly xpProgressBar: Locator;
  readonly xpProgressText: Locator;
  readonly levelTitleText: Locator;
  readonly xpCurrentText: Locator;

  // ─── Level Up Modal ──────────────────────────────────────────────────────

  readonly levelUpModal: Locator;
  readonly levelUpNewLevel: Locator;
  readonly levelUpDismissButton: Locator;
  readonly openLevelUpButton: Locator;

  // ─── Badges ──────────────────────────────────────────────────────────────

  readonly badgeGrid: Locator;
  readonly earnedBadgeCards: Locator;
  readonly lockedBadgeCards: Locator;
  readonly emptyBadgesMessage: Locator;
  readonly badgeProgressBars: Locator;

  // ─── Badge Earned Modal ──────────────────────────────────────────────────

  readonly badgeEarnedModal: Locator;
  readonly badgeEarnedName: Locator;
  readonly badgeEarnedXpReward: Locator;
  readonly badgeEarnedDismissButton: Locator;
  readonly openBadgeEarnedButton: Locator;

  // ─── Streak Counter ──────────────────────────────────────────────────────

  readonly streakCounter: Locator;
  readonly streakCount: Locator;
  readonly streakFireIcon: Locator;

  constructor(page: Page) {
    super(page);

    // XP Progress
    this.xpProgressBar = page.getByRole('progressbar');
    this.xpProgressText = page.getByText(/XP para el siguiente nivel/);
    this.levelTitleText = page.getByText(/Nivel 2: Aprendiz/);
    this.xpCurrentText = page.getByText('250 XP');

    // Level Up Modal
    this.levelUpModal = page.getByRole('dialog', { name: /subiste al nivel/i });
    this.levelUpNewLevel = page.getByText(/Explorador/);
    this.levelUpDismissButton = page.getByRole('button', { name: /genial/i });
    this.openLevelUpButton = page.getByTestId('open-level-up');

    // Badges
    this.badgeGrid = page.getByRole('list', { name: /insignias/i });
    this.earnedBadgeCards = page.locator('[role="article"][aria-label*="Ganada"]');
    this.lockedBadgeCards = page.locator('[role="article"][aria-label*="Bloqueada"]');
    this.emptyBadgesMessage = page.getByText(/aún no tienes insignias/i);
    this.badgeProgressBars = page.getByText(/Progreso/);

    // Badge Earned Modal
    this.badgeEarnedModal = page.getByRole('dialog', { name: /ganaste la insignia/i });
    this.badgeEarnedName = page.getByText(/Puntuación Perfecta/);
    this.badgeEarnedXpReward = page.getByText(/\+50 XP/);
    this.badgeEarnedDismissButton = page.getByRole('button', { name: /increíble/i });
    this.openBadgeEarnedButton = page.getByTestId('open-badge-earned');

    // Streak Counter
    this.streakCounter = page.getByRole('status', { name: /racha de 7 días/i });
    this.streakCount = page.locator(
      '[role="status"][aria-label="Racha de 7 días"] .text-orange-600',
    );
    this.streakFireIcon = page.locator(
      '[role="status"][aria-label="Racha de 7 días"] [aria-hidden="true"]',
    );
  }

  async goto(): Promise<void> {
    await super.goto('/test/gamification');
  }

  /**
   * Wait for the test page to fully render.
   */
  async waitForPageReady(): Promise<void> {
    await expect(this.xpProgressBar).toBeVisible();
    await expect(this.badgeGrid).toBeVisible();
  }

  /**
   * Open the Level Up modal and wait for it to appear.
   */
  async openLevelUpModal(): Promise<void> {
    await this.openLevelUpButton.click();
    await expect(this.levelUpModal).toBeVisible();
  }

  /**
   * Dismiss the Level Up modal and wait for it to close.
   */
  async dismissLevelUpModal(): Promise<void> {
    await this.levelUpDismissButton.click();
    await expect(this.levelUpModal).toBeHidden();
  }

  /**
   * Open the Badge Earned modal and wait for it to appear.
   */
  async openBadgeEarnedModal(): Promise<void> {
    await this.openBadgeEarnedButton.click();
    await expect(this.badgeEarnedModal).toBeVisible();
  }

  /**
   * Dismiss the Badge Earned modal and wait for it to close.
   */
  async dismissBadgeEarnedModal(): Promise<void> {
    await this.badgeEarnedDismissButton.click();
    await expect(this.badgeEarnedModal).toBeHidden();
  }
}
