import { type Page, expect } from '@playwright/test';

import { BasePage } from '../../base-page';

/**
 * Page Object for the Long Text Test Page.
 * Tests for tts-streaming-robust-solution: verifies long text is NOT truncated.
 */
export class LessonPageObject extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    // Test page is fixed
    await super.goto('/test/lesson-long-text');
  }

  get textContainer() {
    return this.page.locator('.bg-white.rounded-3xl');
  }

  get repeatButton() {
    return this.page.getByRole('button', { name: /Iniciar TTS|Reproduciendo/ });
  }

  async verifyPageLoaded(): Promise<void> {
    // Wait for text container to be visible
    await expect(this.textContainer).toBeVisible();
  }

  async verifyFullTextDisplayed(expectedContent: string): Promise<void> {
    await this.textContainer.waitFor({ state: 'visible' });
    const textContent = await this.textContainer.textContent();
    expect(textContent).toContain(expectedContent);
  }

  async verifyTextNotTruncatedAt5000(): Promise<void> {
    await this.textContainer.waitFor({ state: 'visible' });
    const textContent = await this.textContainer.textContent();
    // Expect more than 5000 characters
    expect(textContent && textContent.length).toBeGreaterThan(5000);
  }
}
