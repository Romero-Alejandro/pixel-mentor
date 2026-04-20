# Proposal: Gamification Audit Improvements

## Intent

Resolve all issues identified in the gamification system audit to stabilize the feature. The audit highlighted 5 critical (race conditions, data loss, incorrect calculations), 10 important (duplication, inconsistency, missing validations), and 8 minor issues across the frontend and backend.

## Scope

### In Scope
- Fix 5 critical issues (SSE race conditions, multi-badge data loss, XP calculation bugs)
- Fix 10 important issues (duplicate modal code, validation, error handling)
- Fix 8 minor issues (hardcoded XP values, stylistic inconsistencies)
- Add comprehensive backend and frontend unit tests for gamification flows

### Out of Scope
- Introducing entirely new gamification features (e.g., new types of badges or leaderboards)
- Major UI redesign of gamification components beyond fixing duplication

## Capabilities

### New Capabilities
- `gamification-system`: Formalizing the gamification requirements (XP calculation, badge awarding, real-time SSE updates) to ensure regressions do not occur.

### Modified Capabilities
- None

## Approach

1. **Backend**: 
   - Apply PostgreSQL advisory locks or optimistic concurrency to resolve race conditions and data loss during badge awards.
   - Extract hardcoded XP values to a configuration matrix in `packages/shared`.
   - Ensure all gamification endpoints use strict Zod validation.
2. **Frontend**:
   - Refactor duplicate modal code into a single, generic notification component.
   - Synchronize Zustand gamification store with robust error handling for SSE reconnections.
3. **Testing**: Write Vitest/Jest tests simulating concurrent requests and edge cases.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/features/gamification/` | Modified | Backend services, controllers, and domain logic for XP/badges |
| `apps/web/src/features/gamification/` | Modified | Frontend stores, components, and SSE hooks |
| `packages/shared/` | Modified | Zod schemas and XP configuration constants |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Regressions in existing XP calculation | High | Extensive unit tests covering all existing multipliers and edge cases. |
| SSE connection instability after refactor | Medium | Playwright E2E tests validating the real-time feedback loop. |

## Rollback Plan

Revert the merge commit for this change branch. Database migrations (if any are needed for optimistic locking, such as adding `version` columns) should include a `down` migration, though purely logical changes can be reverted via Git.

## Dependencies

- None

## Success Criteria

- [ ] All 23 identified audit issues are resolved
- [ ] Backend test coverage for gamification logic is >90%
- [ ] No race conditions observed when awarding multiple concurrent badges
