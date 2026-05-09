# Bug Ticket

## Title
Regression: Karaoke effect highlights paragraphs instead of words and fails on restart

---

## Primary Goal
Fix the regression where the karaoke effect now highlights entire paragraphs instead of individual words, and completely fails to start after pressing the "Restart" button.

---

## Related Ticket
This is a regression from the fix applied to:
- [TICKET-karaoke-effect-never-starts.md](TICKET-karaoke-effect-never-starts.md)

---

## Changes After Previous Fix
- ✅ The "Sincronizando..." message now disappears correctly.
- ✅ The karaoke effect now starts (but incorrectly highlights paragraphs).
- ❌ **New Issue**: Highlighting now applies to entire paragraphs instead of individual words.
- ❌ **Restart Regression**: Pressing "Restart" causes the original issue to return (karaoke effect never starts, UI stays stuck on "Sincronizando...").

---

## Expected Flow
1. Lesson step starts automatically.
2. TTS starts automatically.
3. Text highlights **word by word** in sync with TTS.
4. Step finishes.
5. Next step starts automatically.
6. Restart button resets and replays cleanly **with word-by-word highlighting**.

---

## Actual Behavior
### First Playthrough
1. "Sincronizando..." disappears correctly.
2. Karaoke effect starts.
3. **Bug**: Highlights entire paragraphs instead of individual words.
4. Auto-step progression works.

### After Pressing "Restart"
1. **All original symptoms return**:
   - Banner stays stuck on **"Sincronizando..."** (never disappears).
   - Karaoke highlighting **never starts** (no word or paragraph highlighting).
   - Full plain text is shown immediately.
   - No errors or logs are emitted.
   
   *This is identical to the behavior described in [TICKET-karaoke-effect-never-starts.md](TICKET-karaoke-effect-never-starts.md).*

---

## Scope / Suspected Files
- `@/features/lesson/hooks/useTextSync.ts` (word/paragraph boundary logic)
- `@/features/lesson/hooks/useClassOrchestrator.ts` (restart logic)
- `@/features/lesson/components/ActivityPanel.tsx` (highlight rendering)
- `@/features/lesson/stores/lesson.store.ts` (state cleanup)
- `@/audio/types/audio-events.ts` (event granularity)

---

## Investigation Questions
1. Why does the highlight logic now target paragraphs instead of words?
2. What changed in the word-boundary detection or event handling?
3. Why does the restart button trigger the original bug?
4. Is there stale state or incomplete cleanup in `useClassOrchestrator`?
5. Are audio events being re-subscribed correctly after restart?
6. Is the `audioElementReady` state being reset properly?

---

## Acceptance Criteria
- Karaoke effect highlights **word by word** (not paragraphs).
- Restart button works repeatedly without regressing.
- "Sincronizando..." disappears correctly on every playthrough.
- No performance degradation.
- Failures produce explicit logs.

---

## Priority
**Critical** — Core UX feature is now worse than before (partial fix introduced new bugs).