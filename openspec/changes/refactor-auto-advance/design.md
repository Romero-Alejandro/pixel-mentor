# Design: Refactor Auto-Advance System

## Problem Statement

The auto-advance system is broken and overcomplicated:

1. **SSE parsing bug**: Frontend checks `data.type` but backend sends type in `event.event`
2. **AWAITING_START never advances**: Returns `autoAdvance: undefined` instead of `autoAdvance: false`
3. **Implicit auto-advance causes loops**: Adding auto-advance to EXPLANATION causes infinite advancement
4. **Duplicated logic**: Multiple places decide advancement (backend fast paths, state machine, classification; frontend autoAdvance flag, AWAITING_START handler)

## Technical Approach

**Eliminate frontend auto-advance logic entirely.** The backend controls the flow deterministically:

1. Backend always sends `pedagogicalState` - this is the source of truth
2. Frontend simply renders the state it receives - no business logic
3. AWAITING_START triggers ONE automatic interaction on lesson start only
4. Remove all `autoAdvance` logic from frontend

## Architecture Decisions

### Decision 1: Remove autoAdvance field from frontend DTO

**Choice**: Remove `autoAdvance` from `LessonResponse` interface in frontend
**Alternatives**: Keep it but ignore it
**Rationale**: Eliminates confusion - if field exists, developers will try to use it

### Decision 2: Keep autoAdvance in backend for logging/monitoring

**Choice**: Keep `autoAdvance` in backend DTOs but don't act on it in frontend
**Alternatives**: Remove from backend entirely
**Rationale**: Useful for debugging/metrics - signals what backend intended

### Decision 3: AWAITING_START triggers once, not continuously

**Choice**: One-time auto-trigger only on lesson init (not on every AWAITING_START)
**Alternatives**: Always auto-trigger on AWAITING_START
**Rationale**: AWAITING_START can appear multiple times during a lesson - only the first one should auto-advance

## Data Flow

```
Backend                              Frontend
  │                                     │
  ├─── pedagogicalState ──────────────► │ (render only)
  │                                     │
  │  (NO auto-advance logic)           │
  └─────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/features/lesson/hooks/useClassOrchestrator.ts` | Modify | Remove `autoAdvance` usage, simplify state handling |
| `apps/api/src/shared/dto/index.ts` | Modify | Keep `autoAdvance` in schema but mark deprecated |
| `apps/api/src/features/recipe/application/use-cases/orchestrate-recipe.use-case.ts` | Modify | Ensure AWAITING_START always returns `autoAdvance: false` |

## Interface Changes

**Frontend `LessonResponse` interface:**
```typescript
// REMOVE autoAdvance field - frontend doesn't use it
interface LessonResponse {
  voiceText?: string;
  pedagogicalState: PedagogicalState;
  staticContent?: StaticContent;
  sessionCompleted?: boolean;
  lessonProgress?: { currentStep: number; totalSteps: number };
  // autoAdvance removed - backend controls flow
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Backend sends correct pedagogicalState | Test orchestrate-recipe use case |
| Integration | Full flow AWAITING_START → EXPLANATION | API tests with real DB |
| Manual | Start lesson, verify auto-advances correctly | Playwright E2E |

## Migration

No migration required. This is internal logic refactoring with no user-visible changes.

## Open Questions

- [ ] Should we remove `autoAdvance` from backend DTOs entirely? (For simplicity)
- [ ] Add integration test for AWAITING_START → EXPLANATION flow?