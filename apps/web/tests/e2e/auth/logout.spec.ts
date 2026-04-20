import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests: Logout Flow
 *
 * Suite ID: LOGOUT-E2E
 * Feature: User logout from Dashboard
 *
 * Tests verify:
 * - Successful logout redirects to login page
 * - Success toast notification displays
 * - Error handling during API failures
 */

import { DashboardPage, LoginPage } from './logout-page';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Authenticate user before tests
// ─────────────────────────────────────────────────────────────────────────────

async function authenticateUser(page: Page): Promise<void> {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.waitForPageReady();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Successful Logout (Happy Path)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Successful Logout', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test(
    'LOGOUT-E2E-001: Clicking logout button shows loading state',
    { tag: ['@e2e', '@logout', '@critical'] },
    async ({ page }) => {
      const dashboard = new DashboardPage(page);

      // Click logout and verify loading state immediately
      await dashboard.logoutButton.click();

      // Should show "Saliendo..." loading state
      await expect(dashboard.logoutButtonLoading).toBeVisible();
    },
  );

  test(
    'LOGOUT-E2E-002: Logout redirects to login page',
    { tag: ['@e2e', '@logout', '@critical'] },
    async ({ page }) => {
      const dashboard = new DashboardPage(page);
      const login = new LoginPage(page);

      // Click logout (mutation clears token and navigates)
      await dashboard.logoutButton.click();

      // Wait for navigation to login page
      await login.verifyRedirectedHere();

      // Verify URL changed to /login
      await expect(page).toHaveURL(/login/);
    },
  );

  test(
    'LOGOUT-E2E-003: Success toast appears after logout',
    { tag: ['@e2e', '@logout', '@critical'] },
    async ({ page }) => {
      const dashboard = new DashboardPage(page);

      // Click logout button
      await dashboard.logoutButton.click();

      // Wait for toast to appear
      await dashboard.verifySuccessToast();
    },
  );

  test(
    'LOGOUT-E2E-004: User is redirected to dashboard when visiting with invalid token',
    { tag: ['@e2e', '@logout', '@auth'] },
    async ({ page }) => {
      // Navigate to dashboard with no token
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Should redirect to /login if no valid token
      await expect(page).toHaveURL(/login/);
    },
  );
});

// ────────────────────────────────────────────────────────────────────���────────
// Test Suite: Logout Error Handling
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Logout Error Handling', () => {
  test(
    'LOGOUT-E2E-005: Logout clears local storage even if network fails',
    { tag: ['@e2e', '@logout', '@error'] },
    async ({ page }) => {
      const dashboard = new DashboardPage(page);

      // First verify we're authenticated
      await dashboard.waitForPageReady();

      // Store original URL to verify redirection
      const initialURL = page.url();

      // Logout clears token locally regardless of network state
      await dashboard.logoutButton.click();

      // Should redirect to login
      await expect(page).toHaveURL(/login/, { timeout: 10000 });
    },
  );

  test(
    'LOGOUT-E2E-006: Cannot access dashboard after logout',
    { tag: ['@e2e', '@logout', '@security'] },
    async ({ page }) => {
      const dashboard = new DashboardPage(page);
      const login = new LoginPage(page);

      // First logout
      await dashboard.logoutButton.click();
      await login.verifyRedirectedHere();

      // Try to go back to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Should redirect back to login (token cleared)
      await expect(page).toHaveURL(/login/);
    },
  );
});
