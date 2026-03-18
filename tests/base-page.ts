import { type Page } from '@playwright/test';

/**
 * Base Page Object — all page objects extend this
 * Common navigation and verification helpers
 */
export class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigate to a path relative to the base URL
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for the page to have a specific URL
   */
  async waitForURL(pattern: string | RegExp): Promise<void> {
    await this.page.waitForURL(pattern);
  }

  /**
   * Get current URL
   */
  getCurrentURL(): string {
    return this.page.url();
  }

  /**
   * Wait for page to be ready (network idle)
   */
  async waitForReady(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}
