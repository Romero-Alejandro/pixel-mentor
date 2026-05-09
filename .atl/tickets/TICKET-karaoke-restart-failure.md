# Bug Ticket

## Title
**Critical Regression**: Karaoke effect fails to restart after first playthrough — "Sincronizando..." banner stays stuck, highlighting never begins

---

## Primary Goal
Fix the **restart failure** where the karaoke effect works on the first playthrough but **completely breaks** after pressing the "Restart" button, reverting to the original bug described in [TICKET-karaoke-effect-never-starts.md](TICKET-karaoke-effect-never-starts.md).

---

## Related Tickets
- **Regression from**: [TICKET-karaoke-regression-paragraph-highlight.md](TICKET-karaoke-regression-paragraph-highlight.md)
- **Original bug**: [TICKET-karaoke-effect-never-starts.md](TICKET-karaoke-effect-never-starts.md)

---

## Current Behavior
### First Playthrough (✅ Works)
1. Lesson starts automatically.
2. TTS begins.
3. "Sincronizando..." banner disappears.
4. **Karaoke effect works**: Word-by-word highlighting in sync with audio.
5. Step completes and advances.

### After Pressing "Restart" (❌ Fails)
1. "Sincronizando..." banner **stays stuck indefinitely**.
2. Karaoke highlighting **never starts** (no word or paragraph highlighting).
3. Full plain text is shown immediately.
4. **No errors or logs** are emitted (silent failure).
5. Auto-step progression **still works** (only the karaoke effect is broken).

---

## Expected Flow
1. Lesson step starts automatically.
2. TTS starts automatically.
3. "Sincronizando..." disappears when audio begins.
4. Text highlights **word by word** in sync with TTS.
5. Step finishes.
6. **Restart button** resets and replays cleanly **with word-by-word highlighting** (no infinite "Sincronizando...").

---

## Root Cause Hypothesis
Despite fixes to:
- Clean up event listeners in `useTextSync.reset()`,
- Reset `audioElementReady` in `useVoice.stop()`,
- Order cleanup in `useClassOrchestrator.reset()`,

**The issue persists**, suggesting:
1. **Stale state in `lessonStore`**: Global state (e.g., `isSpeaking`, `currentStep`) may not reset fully.
2. **Race condition in event re-subscription**: Listeners may detach/attach out of order during restart.
3. **Incomplete cleanup in `useAutoStart`**: The auto-start logic may not trigger correctly after restart.
4. **Missing dependency in `useTextSync`**: The `reset` function may not react to all required state changes.

---

## Scope / Suspected Files
| File | Suspected Issue | Status
|------|------------------|--------
| `@/features/lesson/hooks/useTextSync.ts` | Event listener cleanup | ✅ Fixed (but may need deeper review)
| `@/features/lesson/hooks/useClassOrchestrator.ts` | Reset order/state | ✅ Fixed
| `@/features/lesson/hooks/useAutoStart.ts` | Restart trigger logic | ❓ Not reviewed
| `@/features/lesson/stores/lesson.store.ts` | Global state reset | ❓ Likely culprit
| `@/features/voice/hooks/useVoice.ts` | `audioElementReady` reset | ✅ Fixed
| `@/features/lesson/components/ActivityPanel.tsx` | Sync state rendering | ❓ May need debug logs
| `@/pages/LessonPage.tsx` | Prop drilling/integration | ❓ Check restart flow

---

## Investigation Questions
1. **State Inspection**: What is the value of `lessonStore.isSpeaking` before/after restart?
2. **Event Flow**: Are `timeupdate`/`ended` events firing on the **new** audio element after restart?
3. **Subscription Order**: Does `useTextSync` re-subscribe to events **after** the new audio element is ready?
4. **Race Conditions**: Is there a delay between `voiceStop()` and `textSync.reset()` that leaves stale listeners?
5. **Debug Logs**: Add logs for:
   - `lessonStore` state transitions during restart,
   - `useTextSync` listener attachment/detachment,
   - `audioElementReady` state before/after restart.

---

## Acceptance Criteria
- [ ] Karaoke effect restarts **repeatedly** without failure.
- [ ] "Sincronizando..." disappears **within 1 second** of audio starting.
- [ ] Word-by-word highlighting works on **every** playthrough (first and all restarts).
- [ ] No performance degradation or memory leaks.
- [ ] Failures produce **explicit logs** (no silent errors).

---

## Priority
**Critical** — Core UX feature is **completely broken** on restart, worse than the original bug.

---

## Reproduction Steps
1. Open any lesson (e.g., `TEST_ID_LESSON="4c0676a2-7b8f-4959-8bd1-0ab7d5a024b0"`).
2. Let it auto-start (verify karaoke works).
3. Click "Restart."
4. Observe:
   - "Sincronizando..." stays stuck.
   - No highlighting.
   - Console shows **no errors**.

---

## Debugging Plan
1. **Add Logs**: Instrument `lessonStore`, `useTextSync`, and `useVoice` with restart-specific logs.
2. **State Dump**: Capture the full state of `lessonStore` and `useTextSync` before/after restart.
3. **Event Tracing**: Verify `timeupdate` events fire on the new audio element.
4. **Manual Reset Test**: Force-call `lessonStore.reset()` and `textSync.reset()` in console to isolate the issue.

---

## Temporary Workaround
None — this is a **blocker** for user testing.
