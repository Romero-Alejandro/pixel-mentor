# Bug Ticket

## Title
Silent Bug: Karaoke effect never starts and UI stays stuck on **“Sincronizando...”** in `@apps/web/src/pages/LessonPage.tsx`

---

## Primary Goal

Find the **root cause** preventing the Karaoke text-sync flow from starting.

This is a **silent failure**:
- No console errors
- No runtime errors
- No visible crash

---

## Scope / Suspected Files

- `@apps/web/src/pages/LessonPage.tsx`
- `@/contexts/AudioContext.tsx`
- `@/audio/types/audio-events.ts`
- `@/features/lesson/constants/lesson.constants.ts`
- `@/features/lesson/components/LessonHeader.tsx`
- `@/features/lesson/components/ConcentrationPanel.tsx`
- `@/features/lesson/components/QuestionPanel.tsx`
- `@/features/lesson/components/ActivityPanel.tsx`
- `@/features/lesson/components/FeedbackPanel.tsx`
- `@/features/lesson/components/CompletedPanel.tsx`
- `@/features/lesson/hooks/useClassOrchestrator.ts`
- `@/features/lesson/hooks/useAutoStart.ts`
- `@/features/lesson/hooks/useTextSync.ts`
- `@/features/voice/hooks/useVoiceSettings.ts`
- `@/features/lesson/stores/lesson.store.ts`

---

## Expected Flow

1. Lesson step starts automatically.
2. TTS starts automatically.
3. Text highlights **word by word** in sync with TTS.
4. Step finishes.
5. Next step starts automatically.
6. Restart button resets and replays cleanly.

---

## Actual Behavior

1. Banner above text panel stays on **“Sincronizando...”**
2. Karaoke highlighting never starts.
3. Full plain text is shown immediately.
4. Auto-step progression still works.
5. UI remains responsive.
6. No errors are emitted.

---

## Important Signal

Most lesson systems still work:
- Panels render correctly
- Steps advance automatically
- UI is responsive

This strongly suggests the bug is isolated to:

**text sync ↔ TTS events ↔ karaoke state transition**

---

## Reproduction Steps

1. Open lesson page.
2. Wait for auto-start.
3. Observe text panel.
4. “Sincronizando...” appears.
5. Highlighting never begins.
6. Step still advances automatically.
7. Press Restart.
8. Same result repeats.

---

## Investigation Questions

1. What condition sets **Synchronizing** state?
2. What code should clear it?
3. Is TTS actually starting?
4. Are word-boundary / progress events firing?
5. Is cleanup logic cancelling listeners early?
6. Is restart leaving stale state/timers/subscriptions?
7. Is `useTextSync` never resolving / never updating state?

---

## Acceptance Criteria

- “Sincronizando...” disappears when audio begins.
- Karaoke highlight runs word-by-word from start to end.
- Auto-step progression still works.
- Restart works repeatedly.
- Failures produce explicit logs and visible fallback state.

---

## Priority

**High** — Core UX feature broken, difficult to diagnose due to silent failure.
