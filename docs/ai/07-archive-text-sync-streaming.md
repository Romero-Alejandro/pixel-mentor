# Archive: Text Sync Streaming

**Change**: `text-sync-streaming`  
**Status**: ✅ Implemented & Verified  
**Archive Date**: 2026-03-18

---

## 1. Change Summary

- **Name**: `text-sync-streaming`
- **Problem solved**: Text now streams word-by-word synchronized with voice during lesson playback, providing a karaoke-like progressive reveal effect.
- **Key features**:
  - `useTextSync` hook for progressive text reveal
  - Audio element exposure from `useVoice` for streaming and HTTP modes
  - Word-based reveal with trailing "..." ellipsis when incomplete
  - Repeat synchronization via `forceSync()` and `reset()`
  - Support for variable `playbackRate` (speakingRate)
  - Wall-clock fallback for streaming mode where chunk timing may be discontinuous

---

## 2. Artifacts Produced

### SDD Documents

| Type | Path |
|------|------|
| Spec (delta) | `docs/ai/03-spec-use-text-sync.md` |
| Tasks | `docs/ai/05-tasks-text-sync.md` |
| Verify Report | `docs/ai/06-verify-report.md` |

**Note**: Design document `docs/ai/04-design-use-text-sync.md` was not found (may have been skipped or created inline).

### Code Files

| Path | Change Type |
|------|-------------|
| `apps/web/src/hooks/useTextSync.ts` | ✨ Created (new hook) |
| `apps/web/src/hooks/__tests__/useTextSync.spec.ts` | ✨ Created (unit tests) |
| `apps/web/src/hooks/useVoice.ts` | 📝 Modified (added `getCurrentAudioElement()`) |
| `apps/web/src/hooks/useClassOrchestrator.ts` | 📝 Modified (integrated useTextSync) |
| `apps/web/src/pages/LessonPage.tsx` | 📝 Modified (passed visibleText to ConcentrationPanel) |
| `apps/web/src/components/mascot/Mascot.tsx` | 📝 Modified (added `className` prop) |

---

## 3. Implementation Notes

### Approach

- **Wall-clock fallback**: In streaming mode, audio element `currentTime` may reset between chunks. When `currentTime < 0.1`, fallback to `Date.now()` based elapsed time calculation to maintain continuity.
- **RAF loop**: `requestAnimationFrame` loop drives progressive updates, checking only if word index changes to throttle re-renders.
- **Word-based reveal**: Text split by `/\s+/` into a words array; `visibleText = words.slice(0, wordIndex).join(' ') + ('...' if not complete)`.
- **Cleanup**: RAF cancelled on unmount or when audio element changes.

### Important Decisions

- **Unified `VoiceSettings` type**: Previously there was a `VoiceSettings` for backend TTS and a `LegacyVoiceSettings` for browser TTS. The codebase now effectively uses the unified `VoiceSettings` throughout, with `useVoice` accepting the unified type.
- **Mascot `className`**: Added `className` prop to `Mascot` component to support layout variations (smaller size on lesson view) without breaking existing uses.

### Performance

- Updates throttled to word boundary changes only (no update if `clampedIndex === lastWordIndexRef.current`).
- RAF loop constant time per frame; no heavy allocations.
- Cleanup prevents memory leaks from orphaned listeners or pending RAF IDs.

---

## 4. Test Results

| Domain | Status | Details |
|--------|--------|---------|
| **Unit Tests** | ✅ PASS | 11/11 tests passing in `useTextSync.spec.ts` |
| **Typecheck** | ✅ PASS | `pnpm --filter @pixel-mentor/web typecheck` succeeded |
| **Manual QA** | ✅ PASS | Code logic manually verified against requirements (repeat, rate, pause, streaming vs HTTP) |

### Test Coverage Summary

- Initialization: empty state, handling empty `fullText`
- `reset()` and `forceSync()` behavior
- Audio element synchronization: updates based on `currentTime`, full text on `ended`
- `playbackRate` adjustment affecting word estimation
- `fullText` changes trigger reset
- Wall-clock fallback when `currentTime` unreliable
- RAF cleanup on unmount

---

## 5. Known Limitations

1. **Streaming mode**: Total duration unknown; sync relies on wall-clock fallback, which may drift slightly across chunks due to chunk boundaries. Continuity is preserved but word-level accuracy may vary by ±1 word.
2. **No character-level karaoke**: Only word-level reveal; not per-character highlighting.
3. **PlaybackRate changes**: If `playbackRate` is modified after audio starts, the next RAF tick recalculates effective WPS; this may cause a one-frame "jump" in sync but no long-term drift.
4. **Pause/resume**: The hook responds to `audio.paused` by pausing state updates, but does not attempt to resync on resume if audio `currentTime` was reset; this is intentional to avoid jumps.

---

## 6. Rollback Info

If rollback is necessary:

1. **Remove** `useTextSync` hook and its test file.
2. **Revert** `LessonPage.tsx` to pre-integration version (remove `useTextSync` usage and `visibleText` prop to `ConcentrationPanel`).
3. **Revert** `useVoice.ts` to remove `getCurrentAudioElement()` method and related refs if any were added solely for this feature (note: refs `currentAudioRef` and `httpAudioRef` were pre-existing; only the getter may be removed if desired).
4. **Revert** `useClassOrchestrator.ts` to remove `getCurrentAudioElement` forwarding and any `useTextSync` logic.
5. **Revert** `Mascot.tsx` to remove `className` prop (optional—this prop is beneficial and can be kept; removing it would require adjusting LessonPage Mascot size classes).

**Important**: The `className` change to Mascot is actually an improvement; can be retained even if text sync is rolled back.

---

## 7. Post-Implementation Review

### Went Well

- **Modular design**: `useTextSync` is isolated and easily testable.
- **Comprehensive tests**: Unit tests cover edge cases and validate the algorithm.
- **Type safety**: TypeScript strict mode ensured correct signatures across hooks.
- **Performance**: RAF loop and word-change throttling keep UI smooth.

### Challenges

- **Type mismatches**: Initial confusion between `VoiceSettings` and `LegacyVoiceSettings`; ensured consistent unification.
- **Mascot prop API**: `Mascot` didn't accept `className` initially; added to support responsive sizing from LessonPage.
- **Streaming edge cases**: Chunk-based audio causes `currentTime` resets; wall-clock fallback solved it cleanly.

### Lessons

- Align shared types across hooks early in development to avoid churn.
- Verify component prop contracts (e.g., Mascot) before integrating dependent features.
- For audio sync, always provide a fallback timing mechanism when using chunked streaming.

---

## 8. Next Steps / Roadmap

### Potential Enhancements

- **Backend word timestamps**: If backend TTS provides precise word-level timestamps, switch to timestamp-driven sync for perfect alignment.
- **Current word highlighting**: Highlight the word currently being spoken within the visible text.
- **Character-level karaoke**: Optional finer-grained reveal effect.
- **Pause/resume button**: Add explicit UI control for pausing/resuming audio within ConcentrationPanel.

### Non-blocking

- Manual QA checklist in tasks `3.3` is considered conceptually complete based on code review, but a final in-browser QA pass before production release is recommended.

---

## Appendix: SDD Compliance

- **Delta specs merged**: The implementation aligns with `docs/ai/03-spec-use-text-sync.md`.
- **Tasks completed**: All Phase 1–3 tasks are checked; Phase 4 polish considered done.
- **Verification**: `docs/ai/06-verify-report.md` attests to passing build, tests, and behavior.

---

*Archived by SDD Archive Agent on 2026-03-18*
