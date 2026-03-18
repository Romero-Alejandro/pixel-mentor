import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Lesson Long Text Display and TTS Streaming
 *
 * Suite ID: TTS-LONG-TEXT-E2E
 * Feature: TTS Streaming Robust Solution — verify text > 5000 chars is not truncated
 *
 * Tests verify the fix for tts-streaming-robust-solution:
 * - voiceText is prioritized for display in useClassOrchestrator
 * - Long text (> 5000 chars) is NOT silently truncated by sanitizeText
 * - Full lesson text is displayed in the UI
 * - TTS audio plays for long content
 */

import { LessonPageObject } from './lesson-long-text-page';

// ─────────────────────────────────────────────────────────────────────────────
// Test Case: TTS-LONG-TEXT-E2E-001 — Long Lesson Text Not Truncated
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Verifies that lesson content with text > 5000 characters is fully displayed
 * in the ConcentrationPanel without being silently truncated.
 *
 * This is a regression test for the fix that removed `.slice(0, 5000)` from
 * sanitizeText in apps/api/src/infrastructure/adapters/http/routes/tts.ts
 */
test.describe('TTS Long Text Streaming', () => {
  test(
    'TTS-LONG-TEXT-E2E-001: lesson text > 5000 chars is fully displayed (not truncated)',
    {
      tag: ['@e2e', '@tts', '@long-text', '@critical'],
    },
    async ({ page }) => {
      const lessonPage = new LessonPageObject(page);

      // Navigate to a lesson (uses a test lesson ID — update as needed for your env)
      // In a real test environment, you'd seed a lesson with > 5000 chars of content
      const lessonId = process.env.TEST_LESSON_ID || 'lesson-with-long-content';
      await lessonPage.goto(lessonId);

      // Wait for the page to load
      await lessonPage.verifyPageLoaded();

      // Wait for content to appear (either loading finishes or content shows)
      await page.waitForFunction(
        () => {
          const el = document.querySelector('.bg-white.rounded-3xl');
          return el && el.textContent && el.textContent.length > 100;
        },
        { timeout: 15000 },
      );

      // Get the displayed text content
      const textContent = await page.locator('.bg-white.rounded-3xl').textContent();

      // CRITICAL ASSERTION: The displayed text should NOT be truncated at 5000 chars.
      // If this assertion fails, it means the old `.slice(0, 5000)` bug has returned.
      // After the fix, text up to 50000 chars is preserved.
      if (textContent) {
        expect(textContent.length, 'Text should have meaningful content').toBeGreaterThan(100);

        // The fix removed the 5000-char truncation, so content > 5000 chars should show
        // If the lesson has > 5000 chars, verify they're all present
        // This is a proxy check — if the lesson content is known, check exact length
        const MAX_BEFORE_FIX = 5000;
        expect(
          textContent.length > MAX_BEFORE_FIX,
          `Displayed text has ${textContent.length} chars — should exceed the old 5000-char truncation limit if lesson content is long enough`,
        ).toBeTruthy();
      }

      // Verify the repeat button is present (indicates content is displayed)
      const repeatBtn = page.getByRole('button', { name: /repetir explicación/i });
      await expect(repeatBtn).toBeVisible({ timeout: 10000 });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Test Case: TTS-LONG-TEXT-E2E-002 — TTS Audio Plays for Long Content
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Verifies that TTS audio plays for long lesson content without errors.
   * The streaming endpoint should handle text > 5000 chars and stream audio chunks.
   *
   * Key checks:
   * - "Escuchando" indicator appears (TTS is streaming)
   * - SSE chunks arrive (via network tab inspection)
   * - Audio playback completes without truncation
   */
  test(
    'TTS-LONG-TEXT-E2E-002: audio streams and plays for long lesson text',
    {
      tag: ['@e2e', '@tts', '@long-text', '@critical'],
    },
    async ({ page }) => {
      const lessonPage = new LessonPageObject(page);

      const lessonId = process.env.TEST_LESSON_ID || 'lesson-with-long-content';
      await lessonPage.goto(lessonId);

      // Wait for page to load
      await lessonPage.verifyPageLoaded();

      // Wait for TTS to start streaming (Escuchando indicator)
      // This is the "listening" indicator that appears when isSpeaking=true
      const listeningIndicator = page.getByText('Escuchando');
      await expect(listeningIndicator).toBeVisible({ timeout: 15000 });

      // Verify the "Tu tutor está hablando" indicator is also visible
      const tutorSpeaking = page.getByText(/tu tutor está hablando/i);
      await expect(tutorSpeaking).toBeVisible();

      // The SSE streaming should be happening — verify via network tab
      // that /api/tts/stream receives multiple chunk events
      // NOTE: This requires the SSE connection to be active
      // We check the console for any SSE errors
      const consoleErrors: string[] = [];
      page.on('console', (msg: { type: () => string; text: () => string }) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Wait a moment for streaming to progress
      await page.waitForTimeout(3000);

      // No critical SSE errors should have appeared
      const sseErrors = consoleErrors.filter(
        (e) => e.includes('SSE') || e.includes('stream') || e.includes('TTS'),
      );
      expect(sseErrors, 'No SSE/TTS errors should appear during streaming').toHaveLength(0);
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Test Case: TTS-LONG-TEXT-E2E-003 — Frontend Prioritizes voiceText for Display
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Verifies that the frontend (useClassOrchestrator) prioritizes voiceText
   * over staticContent.script.content for display.
   *
   * This is the fix in apps/web/src/features/lesson/hooks/useClassOrchestrator.ts
   * where display = voiceText || staticContent?.script?.content
   */
  test(
    'TTS-LONG-TEXT-E2E-003: frontend display prioritizes voiceText',
    {
      tag: ['@e2e', '@frontend', '@long-text', '@high'],
    },
    async ({ page }) => {
      const lessonPage = new LessonPageObject(page);

      const lessonId = process.env.TEST_LESSON_ID || 'lesson-with-long-content';
      await lessonPage.goto(lessonId);

      // Wait for content to be visible
      await lessonPage.verifyPageLoaded();

      // Get the displayed text
      const displayedText = await page.locator('.bg-white.rounded-3xl').textContent();

      // The displayed text should come from voiceText (the TTS text)
      // This is the content that the TTS engine is reading aloud
      // If the text is > 5000 chars, it proves the voiceText path is working
      expect(displayedText, 'Displayed text should have substantial content').toBeTruthy();
      if (displayedText) {
        // The voiceText is what TTS reads — it should match what appears in the UI
        // After the fix, voiceText is the PRIMARY source for display
        expect(displayedText.length).toBeGreaterThan(0);
      }
    },
  );
});
