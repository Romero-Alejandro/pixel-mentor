# Design: Pedagogical Flow System Refactor

## Technical Approach

This design refactors the pedagogical flow system from a complex, brittle `if/else` structure to a robust, event-driven state machine architecture. The core of the refactor is to introduce a `PedagogicalStateService` that strictly enforces valid state transitions based on a predefined set of events. All ad-hoc logic in `orchestrate-recipe.use-case.ts` will be removed and replaced with calls to this new service.

The system will be driven by a closed set of pedagogical events, decoupling user input from state transitions. A new `TimeoutService` will be implemented on the backend to handle student inactivity and activity timeouts, firing events that the state machine will consume. The frontend will be simplified to a presentation-only layer, receiving state from the backend and removing all local logic for timers, loop detection, and state management.

## Architecture Decisions

### Decision: Centralized State Machine Service

**Choice**: A new `PedagogicalStateService` will be created to wrap the `PedagogicalStateMachine`. All state transitions must go through this service.
**Alternatives considered**: Directly using the `PedagogicalStateMachine` within the `OrchestrateRecipeUseCase`.
**Rationale**: A dedicated service provides better separation of concerns, simplifies the use case, and allows for easier testing and introduction of cross-cutting concerns like logging and error handling for state transitions. It follows the Single Responsibility Principle.

### Decision: Event-Driven Architecture

**Choice**: The system will use a defined set of `PedagogicalEvent` types. The `OrchestrateRecipeUseCase` will be responsible for mapping user input and system events (like timeouts) to these pedagogical events.
**Alternatives considered**: Continuing to drive state changes directly based on user input strings or conditional logic.
**Rationale**: An event-driven approach decouples the state machine from the specifics of user input or system triggers. This makes the logic more predictable, easier to test, and extensible. New triggers can be added without changing the state machine's core logic.

### Decision: Backend-Managed Timeouts

**Choice**: A `TimeoutService` will be implemented on the backend, using `setTimeout` within the session's context to trigger events. A `lastInteractionTime` timestamp will be added to the `SessionCheckpoint`.
**Alternatives considered**: Relying on frontend timers.
**Rationale**: Backend-managed timeouts are more reliable and ensure consistency. Frontend timers can be unreliable due to browser tab inactivity, network issues, or client-side clock inaccuracies. This change centralizes all pedagogical logic on the backend.

## Data Flow

The new data flow will be as follows:

1.  **User Input**: The frontend sends the user's input to the `interact` endpoint.
2.  **Input Classification**: The `OrchestrateRecipeUseCase` classifies the input and maps it to a `PedagogicalEvent`.
3.  **State Transition**: The use case sends the event to the `PedagogicalStateService`.
4.  **Validation**: The service validates the transition against the current state.
5.  **State Update**: If valid, the state machine transitions to the new state, and the `SessionCheckpoint` is updated.
6.  **Response Generation**: The use case generates the response for the frontend based on the new state and the current recipe step.

```
Frontend ──> API (interact) ──> OrchestrateRecipeUseCase
   ^                                      │
   │                                      v
   │                          InputClassifier ──> PedagogicalEvent
   │                                      │
   └────────────── Response <──────────── │
                                          v
                               PedagogicalStateService
                                          │
                                          v
                              PedagogicalStateMachine ──> New State
                                          │
                                          v
                                  SessionRepository ──> Update Checkpoint
```

## File Changes

| File                                                                                 | Action | Description                                                                                                                                   |
| ------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/features/evaluation/application/services/pedagogical-state.service.ts` | Create | New service to manage the pedagogical state machine transitions.                                                                              |
| `apps/api/src/features/evaluation/application/services/timeout.service.ts`           | Create | New service to handle inactivity and activity timeouts.                                                                                       |
| `apps/api/src/features/recipe/application/use-cases/orchestrate-recipe.use-case.ts`  | Modify | Remove all ad-hoc state logic and replace with calls to `PedagogicalStateService`. Map user input to events.                                  |
| `apps/api/src/features/evaluation/domain/entities/pedagogical-state-machine.ts`      | Modify | Update the state transition table to correctly handle `ACTIVITY_WAIT` and new events. Add `EVALUATE_CORRECT` and `EVALUATE_INCORRECT` events. |
| `apps/api/src/features/session/domain/entities/session.entity.ts`                    | Modify | Add `lastInteractionTime: Date` to `SessionCheckpoint`.                                                                                       |
| `packages/shared/src/schemas/step.schemas.ts`                                        | Create | New file to define the unified `Step` discriminated union model.                                                                              |
| `apps/web/src/features/class/components/some-component.tsx`                          | Modify | (Example) Remove frontend state logic, loop detection, and timers. Render based on backend state.                                             |

## Interfaces / Contracts

### Pedagogical Events

```typescript
export type PedagogicalEvent =
  | { type: 'START_CLASS' }
  | { type: 'RESTART_CLASS' }
  | { type: 'START_LESSON' }
  | { type: 'CONTINUE' }
  | { type: 'NEXT' }
  | { type: 'ADVANCE' }
  | { type: 'ANSWER'; payload: { answer: string } }
  | { type: 'EVALUATE_CORRECT' }
  | { type: 'EVALUATE_INCORRECT' }
  | { type: 'REPEAT_CONCEPT' }
  | { type: 'SKIP_ACTIVITY' }
  | { type: 'RAISE_HAND' }
  | { type: 'RESUME_CLASS' }
  | { type: 'CLARIFY' }
  | { type: 'COMPLETE' }
  | { type: 'ACTIVITY_TIMEOUT' }
  | { type: 'INACTIVITY_WARNING' };
```

### PedagogicalStateService

```typescript
export interface IPedagogicalStateService {
  transition(
    currentCheckpoint: SessionCheckpoint,
    event: PedagogicalEvent,
  ): Promise<SessionCheckpoint>;
}
```

### Unified Step Model (`packages/shared/src/schemas/step.schemas.ts`)

```typescript
export type StepScriptContent = {
  stepType: 'content' | 'intro' | 'closure';
  script: {
    transition?: string;
    content?: string;
    examples?: string[];
    closure?: string;
  };
};

export type StepScriptQuestion = {
  stepType: 'question';
  script: {
    transition?: string;
    question: string;
    expectedAnswer: string;
    hint?: string;
    feedback: { correct: string; incorrect: string };
  };
};

export type StepScriptActivity = {
  stepType: 'activity' | 'exam';
  script: {
    transition?: string;
    instruction: string;
    options: { text: string; isCorrect: boolean }[];
    feedback: { correct: string; incorrect: string };
  };
};

export type Step = StepScriptContent | StepScriptQuestion | StepScriptActivity;
```

### Updated State Transition Table (in `pedagogical-state-machine.ts`)

```typescript
const transitions = {
  // ... (other states remain the same)
  ACTIVITY_WAIT: {
    ANSWER: 'EVALUATION',
    INACTIVITY_WARNING: 'ACTIVITY_WAIT', // Stays in the same state
    ACTIVITY_TIMEOUT: 'ACTIVITY_SKIP_OFFER',
    SKIP_ACTIVITY: 'EXPLANATION', // Or next step
  },
  EVALUATION: {
    EVALUATE_CORRECT: 'EXPLANATION', // Or next step
    EVALUATE_INCORRECT: 'ACTIVITY_WAIT', // Return to wait for another answer
    ADVANCE: 'EXPLANATION', // For advancing after correct answer
  },
  // ...
};
```

## Testing Strategy

| Layer       | What to Test                                                                         | Approach                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | **PedagogicalStateService**: All valid and invalid transitions.                      | Use Jest to test the `transition` method with various state/event combinations. Mock the `PedagogicalStateMachine`.                                                     |
| Unit        | **TimeoutService**: Correct scheduling and firing of timeout events.                 | Use `jest.useFakeTimers()` to test `setTimeout` calls without waiting.                                                                                                  |
| Unit        | **InputClassifier**: Mapping of user inputs to `PedagogicalEvent`s.                  | Provide sample inputs and assert that the correct event is generated.                                                                                                   |
| Integration | **OrchestrateRecipeUseCase**: The overall flow of an interaction.                    | Create integration tests that mock the repositories and services, and verify that a user input triggers the correct state transition and returns the expected response. |
| E2E         | **Full Pedagogical Flow**: A user completing a lesson with questions and activities. | Use Playwright to simulate a user interacting with the frontend, answering questions correctly and incorrectly, and triggering timeouts.                                |

## Migration / Rollout

No data migration is required. This is a pure code refactoring. The changes can be rolled out behind a feature flag if necessary, allowing the old and new orchestration logic to coexist, but a direct replacement is preferred for simplicity given the scale of the refactor.

## Open Questions

- [ ] Should the `TimeoutService` be a singleton or instantiated per session? (Leaning towards per-session to manage timers more easily).
- [ ] How should the `PedagogicalStateService` handle cases where a transition is invalid? (Throw an error, or return the current state?). The design assumes it will throw an `InvalidTransitionError`.
