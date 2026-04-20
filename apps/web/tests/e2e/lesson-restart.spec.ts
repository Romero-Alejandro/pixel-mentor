import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

// Helper to get first active recipeId for student
async function getFirstRecipeId(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) throw new Error('No auth token found in localStorage');

  const response = await page
    .context()
    .request.get('http://localhost:3001/api/recipes?activeOnly=true', {
      headers: { Authorization: `Bearer ${token}` },
    });
  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to list recipes: ${response.status()} ${text}`);
  }
  const data = await response.json();
  const recipes = data.recipes ?? data;
  if (!Array.isArray(recipes) || recipes.length === 0) {
    throw new Error('No active recipes available.');
  }
  return recipes[0].id;
}

test('Test lesson restart functionality', async ({ page }) => {
  // --- 1. Login ---
  await page.goto('/login');
  await expect(page.locator('input[type="text"]')).toBeVisible({ timeout: 10000 });
  await page.fill('input[type="text"]', 'student@test.pixel-mentor.local');
  await page.fill('input[type="password"]', 'testpassword123');
  await page.click('button[type="submit"]');

  // Wait for dashboard to appear (Mapa de Aventuras)
  await expect(page.locator('text=Mapa de Aventuras')).toBeVisible({ timeout: 45000 });

  // --- 2. Get a recipeId ---
  const recipeId = await getFirstRecipeId(page);
  console.log(`[Test] Using recipeId: ${recipeId}`);

  // --- 3. Start lesson ---
  await page.goto(`/lesson/${recipeId}`);

  // Wait for lesson to start: Continuar button visible
  const continueBtn = page.locator('button:has-text("Continuar")');
  await expect(continueBtn).toBeVisible({ timeout: 30000 });

  // --- 4. Complete the lesson ---
  // Fast-forward through lesson steps
  for (let i = 0; i < 20; i++) {
    if (
      await page.locator('text=/completa|completad|misión cumplida/i').isVisible({ timeout: 1000 })
    ) {
      console.log('[Test] Lesson completed');
      break;
    }

    const isContinueVisible = await continueBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (isContinueVisible) {
      await continueBtn.click();
    } else {
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(1000);
  }

  // --- 5. Test restart functionality ---
  // Find and click the restart button
  const restartBtn = page.locator('button:has-text("Repetir")');
  await expect(restartBtn).toBeVisible({ timeout: 10000 });

  // Add debug logging
  console.log('[Test] Clicking restart button');
  await restartBtn.click();

  // Wait for lesson to restart
  console.log('[Test] Waiting for lesson to restart');
  await expect(continueBtn).toBeVisible({ timeout: 15000 });

  // --- 6. Verify restart worked ---
  // Check that we're back at the beginning
  const progressBar = page.locator('[role="progressbar"]').first();
  const currentStep = await progressBar.getAttribute('aria-valuenow');
  console.log(`[Test] Current step after restart: ${currentStep}`);

  // Should be back at step 0 or very close
  expect(parseInt(currentStep || '0', 10)).toBeLessThan(10);
});
