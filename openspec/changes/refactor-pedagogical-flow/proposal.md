# Proposal: Refactor Pedagogical Flow System

## Intent

The current pedagogical flow logic is duplicated across the frontend and backend, leading to inconsistent states, bugs, and high maintenance overhead. The backend contains ad-hoc transition logic instead of using the formally defined state machine. This change will refactor the system to use a centralized, backend-driven state machine as the single source of truth for the pedagogical flow.

## Scope

### In Scope

- Make `PedagogicalStateMachine` the single source of truth for all state transitions.
- Refactor the backend `OrchestrateRecipeUseCase` to be a client of the state machine.
- Refactor the frontend `useClassOrchestrator` hook to be a "dumb" renderer of state received from the backend.
- Implement state-based timeouts on the backend as defined in the state machine configuration.
- Introduce a unified, type-safe data model (discriminated union) for pedagogical steps shared between frontend and backend.
- Remove the frontend "loop detection" workaround.

### Out of Scope

- Changing the existing set of states or valid transitions (i.e., altering the core pedagogical model).
- Introducing new pedagogical features or activities.

## Approach

1.  **Centralize State Logic:** The `OrchestrateRecipeUseCase` on the backend will be modified to import and instantiate the `PedagogicalStateMachine`. All incoming events and actions will be passed to the state machine, which will handle all transition logic and validation.
2.  **Backend-Driven State:** The backend will become the sole authority for the pedagogical state. After a state transition, the backend will serialize the new state and push it to the frontend via the existing websocket connection.
3.  **Simplify Frontend:** The `useClassOrchestrator` hook will be refactored to remove all state management and transition logic. It will listen for state updates from the backend and update a simple `pedagogicalState` variable, which will drive the UI rendering.
4.  **Unified Step Model:** A discriminated union type will be created in `packages/shared/` to represent all possible step variations (`ActivityStep`, `EvaluationStep`, etc.). This will replace the current, less-defined types and ensure type safety.
5.  **Implement Timeouts:** The backend will use timers (e.g., `setTimeout`) initiated upon entering a state (like `ACTIVITY_WAIT`) to trigger a "TIMEOUT" event in the state machine after the configured duration.

## Affected Areas

| Area                                                                                 | Impact       | Description                                                              |
| ------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------ |
| `apps/api/src/pedagogical-flow/application/use-cases/orchestrate-recipe.use-case.ts` | Modified     | Will be refactored to use the state machine instead of custom logic.     |
| `apps/api/src/pedagogical-flow/domain/state-machine/pedagogical-state-machine.ts`    | Modified     | Will be integrated into the use case and become the central controller.  |
| `apps/web/src/app/features/class/hooks/useClassOrchestrator.ts`                      | Modified     | All transition logic will be removed; it will become a passive renderer. |
| `packages/shared/src/pedagogical-flow/types.ts`                                      | New/Modified | A new discriminated union type for steps will be defined.                |

## Risks

| Risk                             | Likelihood | Mitigation                                                                                                                                                                                     |
| -------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regressions in pedagogical flow. | Medium     | Develop a suite of integration tests covering all major state transition paths before beginning the refactor. Run these tests throughout the process to ensure existing behavior is preserved. |

## Rollback Plan

The change will be developed on a separate feature branch. If critical issues are found after merging, the merge commit can be reverted, restoring the previous implementation.

## Dependencies

- None

## Success Criteria

- [ ] The `pedagogical-state-machine.ts` is the single source of truth for all transitions.
- [ ] No state transition logic exists in the `useClassOrchestrator.ts` hook.
- [ ] The inconsistent `ACTIVITY_WAIT` to `EVALUATION` stream is fixed.
- [ ] Configured timeouts correctly trigger state transitions on the backend.
- [ ] The frontend renders all states correctly without needing a "loop detection" mechanism.
