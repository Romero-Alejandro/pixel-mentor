import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Complete Lesson Flow
 *
 * Verifies that a student can complete an entire lesson without skipping steps,
 * and that the lesson reaches COMPLETED state correctly.
 */

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

test('Complete lesson flow end-to-end', async ({ page }) => {
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

  // Also wait for initial content
  await expect(page.locator('.bg-white.rounded-3xl')).toBeVisible({ timeout: 10000 });

  // Track progress via progress bar
  const progressBar = page.locator('[role="progressbar"]').first();
  let lastStep = -1;
  let sameStepCount = 0;
  const MAX_SAME_STEP = 6;

  // --- 4. Interaction loop ---
  for (let i = 0; i < 60; i++) {
    const currentStepStr = await progressBar.getAttribute('aria-valuenow').catch(() => null);
    const currentStep = currentStepStr ? parseInt(currentStepStr, 10) : -1;

    // Loop detection
    if (currentStep === lastStep) {
      sameStepCount++;
      if (sameStepCount >= MAX_SAME_STEP) {
        throw new Error(`Stuck on step ${currentStep} for ${sameStepCount} iterations`);
      }
    } else {
      sameStepCount = 0;
      lastStep = currentStep;
      console.log(`[Test] Step ${currentStep}`);
    }

    // Check completion
    if (
      await page.locator('text=/completa|completad|misión cumplida/i').isVisible({ timeout: 1000 })
    ) {
      console.log('[Test] Lesson completed');
      break;
    }

    // Actions
    const isContinueVisible = await continueBtn.isVisible({ timeout: 1000 }).catch(() => false);
    const hasOptions = (await page.locator('[role="button"]:has-text("Option")').count()) > 0;
    const hasQuestionInput = await page
      .locator('textarea')
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    const activitySubmit = page
      .locator('button:has-text("Listo")')
      .or(page.locator('button:has-text("Enviar")'));

    if (isContinueVisible) {
      await continueBtn.click();
    } else if (hasQuestionInput) {
      const qText =
        (await page
          .locator('text=¿')
          .first()
          .textContent()
          .catch(() => '')) || '';
      let answer = 'test';
      const lower = qText.toLowerCase();
      if (lower.includes('capital') || lower.includes('francia')) answer = 'Paris';
      else if (lower.includes('2+2') || lower.includes('2 + 2') || lower.includes('suma 2'))
        answer = '4';
      else if (lower.includes('resta') || lower.includes('5-2')) answer = '3';
      await page.locator('textarea').fill(answer);
      await page.keyboard.press('Enter');
    } else if (hasOptions) {
      await page.locator('[role="button"]:has-text("Option")').first().click();
      if (await activitySubmit.isVisible({ timeout: 1000 })) await activitySubmit.click();
    } else {
      await page.waitForTimeout(1500);
    }

    await page.waitForTimeout(2500);
  }

  // --- 5. Assertions ---
  await expect(page.locator('text=/completa|completad|misión cumplida/i')).toBeVisible({
    timeout: 5000,
  });
  const finalStep = await progressBar.getAttribute('aria-valuenow');
  expect(parseInt(finalStep || '0', 10)).toBeGreaterThanOrEqual(90);
});
