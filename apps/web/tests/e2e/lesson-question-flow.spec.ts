import { test, expect } from '@playwright/test';

const MOCK_RECIPE_ID = 'test-recipe-mixed-steps';

const mockRecipeWithMixedSteps = {
  id: MOCK_RECIPE_ID,
  title: 'Test Recipe - Mixed Steps',
  steps: [
    {
      id: 'step-1',
      stepType: 'question',
      script: {
        question: 'What is the capital of France?',
        expectedAnswer: 'Paris',
        feedback: { correct: 'Correct!', incorrect: 'Try again.' },
      },
    },
    {
      id: 'step-2',
      stepType: 'activity',
      script: {
        instruction: 'Select the correct answer',
        options: [
          { text: 'Option A', isCorrect: true },
          { text: 'Option B', isCorrect: false },
        ],
        feedback: { correct: 'Well done!', incorrect: 'Not quite.' },
      },
    },
  ],
};

test.describe('Lesson Question Flow', () => {
  test.beforeAll(async ({ request }) => {
    // Mock backend responses
    console.log('[E2E] Sending mock recipe to backend:', mockRecipeWithMixedSteps);
    const response = await request.post('/api/recipe/mock/recipe', {
      data: mockRecipeWithMixedSteps,
    });
    const responseText = await response.text();
    console.log('[E2E] Backend response status:', response.status());
    console.log('[E2E] Backend response text:', responseText);
    try {
      const responseJson = JSON.parse(responseText);
      console.log('[E2E] Backend response JSON:', responseJson);
    } catch (e) {
      console.error('[E2E] Failed to parse response as JSON:', e);
    }
  });

  test('should render QuestionPanel for question steps', async ({ page }) => {
    await page.goto(`/lesson/${MOCK_RECIPE_ID}`);

    // Step 1: Question
    await expect(page.locator('text=Pregunta Abierta')).toBeVisible();
    await expect(
      page.locator('textarea[placeholder="Escribe aquí tu respuesta..."]'),
    ).toBeVisible();
    await expect(page.locator('text=What is the capital of France?')).toBeVisible();

    // Submit answer
    await page.fill('textarea', 'Paris');
    await page.click('button:has-text("Enviar")');

    // Verify feedback
    await expect(page.locator('text=Correct!')).toBeVisible();
  });

  test('should render ActivityPanel for activity steps', async ({ page }) => {
    await page.goto(`/lesson/${MOCK_RECIPE_ID}`);

    // Answer question to advance
    await page.fill('textarea', 'Paris');
    await page.click('button:has-text("Enviar")');
    await page.click('button:has-text("Continuar")');

    // Step 2: Activity
    await expect(page.locator('text=¡Tu turno!')).toBeVisible();
    await expect(page.locator('text=Select the correct answer')).toBeVisible();
    await expect(page.locator('text=Option A')).toBeVisible();
    await expect(page.locator('text=Option B')).toBeVisible();
  });

  test('should preserve stepType end-to-end', async ({ page }) => {
    // Network verification
    const responsePromise = page.waitForResponse((resp) =>
      resp.url().includes('/api/recipe/interact'),
    );

    await page.goto(`/lesson/${MOCK_RECIPE_ID}`);
    await page.fill('textarea', 'Paris');
    await page.click('button:has-text("Enviar")');

    const response = await responsePromise;
    const body = await response.json();

    // Verify backend preserves stepType
    expect(body.staticContent.stepType).toBe('question');
  });
});
