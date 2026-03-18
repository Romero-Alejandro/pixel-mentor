# Tasks: Text Sync Streaming Implementation

## Phase 1: Foundation and Hook Development

- [x] 1.1 Create `apps/web/src/hooks/useTextSync.ts` skeleton.
  - Acceptance: Hook compiles and exports `useTextSync` and `TextSyncState` interface.
  - Effort: S
- [x] 1.2 Implement core logic in `useTextSync`.
  - Logic: Word splitting, `requestAnimationFrame` loop, time-based estimation based on `currentTime` or timestamp.
  - Acceptance: Correct `visibleText` calculation based on simple time simulation.
  - Effort: M
  - Dependencies: 1.1
- [x] 1.3 Implement `reset`, `forceSync` (for repeat) in `useTextSync`.
  - Acceptance: `visibleText` resets to empty string and `isSynced` flag works as expected.
  - Effort: S
  - Dependencies: 1.2

## Phase 2: Integration

- [x] 2.1 Update `useVoice.ts` to expose `getCurrentAudioElement` or similar.
  - Description: Need to expose access to the _currently playing_ `HTMLAudioElement` from either `httpAudioRef` or `currentAudioRef` (streaming).
  - Acceptance: `useVoice` returns a method that returns the current playing audio element or null.
  - Effort: M
  - Dependencies: None (independent)
- [x] 2.2 Integrate `useTextSync` in `LessonPage` or `ConcentrationPanel`.
  - Description: Connect `useTextSync` to `voice.getCurrentAudioElement()` and `content.fullText`.
  - Acceptance: UI updates in real-time with audio.
  - Effort: M
  - Dependencies: 1.3, 2.1

## Phase 3: Testing and Fallback

- [x] 3.1 Write unit tests for `useTextSync` (skeleton + logic).
  - File: `apps/web/src/hooks/__tests__/useTextSync.spec.ts`.
  - Acceptance: Tests covering splitting, progress estimation, and rate changes.
  - Effort: M
  - Dependencies: 1.2
- [x] 3.2 Implement fallback logic in `useTextSync`.
  - Description: If audio element is null, fallback to time-based estimation from start timestamp.
  - Acceptance: Text reveals even without active `HTMLAudioElement` (if timing is tracked).
  - Effort: S
  - Dependencies: 1.3
- [ ] 3.3 Manual QA checklist verification.
  - Check: Streaming vs HTTP mode, repeat button, rate changes, pause/resume behavior.
  - Effort: S
  - Dependencies: 2.2

## Phase 4: Polish

- [x] 4.1 Fine-tune performance (`50ms` update throttle).
  - Effort: S
  - Dependencies: 1.2
- [ ] 4.2 Cleanup and documentation.
  - Effort: S
  - Dependencies: All
