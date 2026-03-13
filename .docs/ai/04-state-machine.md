# Session State Machine

<ai_invariants>
[STATE_MACHINE_RULES]

- Isolation: State mutations MUST be encapsulated in `application/use-cases/`.
- Validation: Ensure Optimistic Locking version matches before mutating.

[PERMITTED_TRANSITIONS]

1. `idle` -> (Start Lesson event) -> `active`
2. `active` -> (High confidence interaction) -> `paused_for_question`
3. `paused_for_question` -> (Validated RAG response) -> `awaiting_confirmation`
4. `awaiting_confirmation` -> (Correct verification) -> `active`
5. `awaiting_confirmation` -> (30s Timeout trigger) -> `paused_idle`
6. `active` -> (Lesson content exhausted) -> `completed`
   </ai_invariants>
