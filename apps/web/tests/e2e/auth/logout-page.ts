import { type Page, type Locator, expect } from '@playwright/test';

import { BasePage } from '../../base-page';

/**
 * Page Object for Dashboard and Login pages.
 * Provides locators and helpers for logout flow E2E tests.
 */
export class DashboardPage extends BasePage {
  // ─── Header Elements ───────────────────────────────────────────────────

  readonly logoutButton: Locator;
  readonly logoutButtonLoading: Locator;
  readonly userGreeting: Locator;
  readonly header: Locator;

  // ─── Toast Notification ────────────────────────────────────────────────

  readonly successToast: Locator;
  readonly toastMessage: Locator;

  constructor(page: Page) {
    super(page);

    // Header elements
    this.header = page.locator('header');
    this.userGreeting = page.getByText(/¡Hola|explorador/i);
    this.logoutButton = page.getByRole('button', { name: /Salir/i });
    this.logoutButtonLoading = page.getByRole('button', { name: /Saliendo/i });

    // Toast (success notification)
    this.successToast = page.locator('[data-radix-toast-root]');
    this.toastMessage = page.getByText(/¡Sesión cerrada!/i);
  }

  async goto(): Promise<void> {
    await super.goto('/dashboard');
  }

  /**
   * Wait for Dashboard page to be fully loaded.
   */
  async waitForPageReady(): Promise<void> {
    await expect(this.header).toBeVisible();
    await expect(this.userGreeting).toBeVisible();
  }

  /**
   * Click the logout button and wait for navigation.
   */
  async clickLogout(): Promise<void> {
    await this.logoutButton.click();
  }

  /**
   * Verify the success toast appears.
   */
  async verifySuccessToast(): Promise<void> {
    await expect(this.toastMessage).toBeVisible();
    const subtitle = this.page.getByText(/Hasta pronto/i);
    await expect(subtitle).toBeVisible();
  }
}

/**
 * Page Object for Login page verification.
 */
export class LoginPage extends BasePage {
  readonly loginForm: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly title: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    super(page);

    // Login page elements
    this.title = page.getByText(/Pixel Mentor/i);
    this.loginForm = page.locator('form');
    this.emailInput = page.getByLabel('Correo electrónico o nombre de usuario');
    this.passwordInput = page.getByLabel('Contraseña secreta');
    this.submitButton = page.getByRole('button', { name: /¡Entrar a la Academia!/i });
    this.registerLink = page.getByRole('link', { name: /Crear cuenta/i });
  }

  async goto(): Promise<void> {
    await super.goto('/login');
  }

  /**
   * Wait for Login page to be fully loaded.
   */
  async waitForPageReady(): Promise<void> {
    await expect(this.title).toBeVisible();
    await expect(this.loginForm).toBeVisible();
  }

  /**
   * Verify we're on the login page (post-logout redirect).
   */
  async verifyRedirectedHere(): Promise<void> {
    await this.waitForPageReady();
  }
}
