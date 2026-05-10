import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173'; // Assuming frontend runs on 5173

test.describe('Refresh Token E2E Flow', () => {
  const testUser = {
    email: `e2e-${Date.now()}@example.com`,
    password: 'password123',
    name: 'E2E User',
  };

  test('should transparently refresh token on expiry', async ({ page }) => {
    // 1. Register and Login
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: /registrarse/i }).click();
    await page.getByLabel(/nombre/i).fill(testUser.name);
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByLabel(/contraseña/i).fill(testUser.password);
    await page.getByRole('button', { name: /crear cuenta/i }).click();

    // Should be logged in automatically after registration
    await expect(page.getByText(`Welcome, ${testUser.name}`)).toBeVisible({ timeout: 10000 });

    const initialAccessToken = await page.evaluate(() => localStorage.getItem('token'));
    const initialRefreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));
    expect(initialAccessToken).not.toBeNull();
    expect(initialRefreshToken).not.toBeNull();

    // 2. Intercept API calls to a protected route
    let requestCount = 0;
    let firstRequestHeaders: any = {};
    await page.route('/api/auth/me', (route) => {
        if (requestCount === 0) {
            firstRequestHeaders = route.request().headers();
        }
        requestCount++;
        route.continue();
    });

    // 3. Invalidate the access token in localStorage
    await page.evaluate(() => {
        localStorage.setItem('token', 'invalid-token-for-test');
    });

    // 4. Trigger an action that calls the protected route
    // In this app, simply reloading or navigating might trigger a user fetch
    await page.reload();

    // 5. Verify the refresh flow
    await expect(page.getByText(`Welcome, ${testUser.name}`)).toBeVisible({ timeout: 10000 });
    
    // The request should have been made more than once if refresh happened
    // The interceptor might be complex, so let's focus on the outcome.
    
    const finalAccessToken = await page.evaluate(() => localStorage.getItem('token'));
    const finalRefreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));

    // The tokens should have been updated
    expect(finalAccessToken).not.toBeNull();
    expect(finalAccessToken).not.toBe(initialAccessToken);
    expect(finalAccessToken).not.toBe('invalid-token-for-test');
    
    expect(finalRefreshToken).not.toBeNull();
    // Refresh token might or might not be rotated, depending on server policy.
    // Our policy is to rotate, so it should be different.
    expect(finalRefreshToken).not.toBe(initialRefreshToken);

    // Now, let's verify logout
    await page.getByRole('button', { name: /logout|salir/i }).click();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();

    const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('token'));
    const refreshTokenAfterLogout = await page.evaluate(() => localStorage.getItem('refreshToken'));

    expect(tokenAfterLogout).toBeNull();
    expect(refreshTokenAfterLogout).toBeNull();
  });
});
