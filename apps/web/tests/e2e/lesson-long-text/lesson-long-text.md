### E2E Tests: Lesson Long Text TTS Streaming

**Suite ID:** `TTS-LONG-TEXT-E2E`
**Feature:** TTS Streaming Robust Solution — verify long text (> 5000 chars) is NOT truncated

---

## Test Case: `TTS-LONG-TEXT-E2E-001` — Long Lesson Text Not Truncated

**Priority:** critical

**Tags:**

- type → @e2e
- feature → @tts, @long-text

**Description/Objective:** Verify that lesson content with text > 5000 characters is fully displayed in the ConcentrationPanel without being silently truncated. This is a regression test for the `.slice(0, 5000)` bug fix.

**Preconditions:**

- API server running with the tts-streaming-robust-solution changes
- Web app running at BASE_URL
- A lesson with > 5000 chars of content seeded (set `TEST_LESSON_ID` env var)

### Flow Steps:

1. Navigate to `/lesson/:lessonId`
2. Wait for page to load
3. Wait for text content to appear (> 100 chars)
4. Verify the "Repetir explicación" button is visible

### Expected Result:

- Displayed text length > 5000 chars (proving no silent truncation)
- Full lesson content visible in the UI

---

## Test Case: `TTS-LONG-TEXT-E2E-002` — TTS Audio Streams for Long Content

**Priority:** critical

**Tags:**

- type → @e2e
- feature → @tts, @long-text

**Description/Objective:** Verify that TTS audio streams correctly for long lesson content without errors, and the "Escuchando" (listening) indicator appears.

**Preconditions:**

- API server with TTS streaming endpoint
- Web app running

### Flow Steps:

1. Navigate to lesson page
2. Wait for "Escuchando" indicator to appear
3. Verify "Tu tutor está hablando" indicator is visible
4. Check console for SSE/TTS errors

### Expected Result:

- Listening indicator visible (TTS streaming active)
- No SSE or TTS errors in console
- Audio chunks arriving via SSE

---

## Test Case: `TTS-LONG-TEXT-E2E-003` — Frontend Prioritizes voiceText

**Priority:** high

**Tags:**

- type → @e2e
- feature → @frontend, @long-text

**Description/Objective:** Verify that the frontend (`useClassOrchestrator`) prioritizes `voiceText` over `staticContent.script.content` for display. This is the fix in `useClassOrchestrator.ts` where `display = voiceText || staticContent?.script?.content`.

**Preconditions:**

- API and web app running
- A lesson with distinct `voiceText` content

### Flow Steps:

1. Navigate to lesson page
2. Wait for content to be displayed
3. Verify the displayed text matches `voiceText`

### Expected Result:

- The displayed text comes from `voiceText` (TTS source)
- Text is NOT truncated at 5000 chars

---

## Running These Tests

```bash
# From the apps/web directory

# Install browsers (once)
npx playwright install chromium

# Run all E2E tests
npx playwright test

# Run only these tests
npx playwright test tests/e2e/lesson-long-text/

# Run with UI
npx playwright test tests/e2e/lesson-long-text/ --ui

# Debug mode
npx playwright test tests/e2e/lesson-long-text/ --debug

# Set environment variables
TEST_LESSON_ID=your-lesson-id BASE_URL=http://localhost:5173 npx playwright test
```
