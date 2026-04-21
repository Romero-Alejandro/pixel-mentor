# Skill Registry for pixel-mentor

## Available Skills (Capability Inventory)

_This inventory defines the technical expertise of the project. Use it for planning and delegation._

- **api-design-principles**: RESTful API design, status codes, and resource naming.
- **backend-testing**: Unit and integration testing patterns using Jest and Supertest.
- **brainstorming**: Intent discovery and requirements analysis before coding.
- **clean-ddd-hexagonal**: Hexagonal Architecture (Ports & Adapters) and Domain-Driven Design.
- **error-handling-patterns**: Custom Error classes, structural logging, and fail-fast logic.
- **playwright**: E2E testing strategies, locators, and visual regression.
- **react-19**: React Compiler patterns, Server Components, and optimized rendering.
- **security-best-practices**: OWASP mitigation, Argon2id, JWT, and input sanitization.
- **supabase-postgres-best-practices**: Query optimization, RLS, and schema migrations.
- **systematic-debugging**: Forensic tracing, root cause isolation, and repro-scripting.
- **tailwind-4 & zustand-5**: Modern styling and atomic/reactive state management.
- **typescript**: Strict typing, discriminated unions, and `readonly` by default.
- **zod-4**: Runtime schema validation and type inference.

---

## Compact Rules

_Injected rules to ensure technical excellence during execution._

### [rule: global-code-quality]

**1. Clean Code & Declarative Structure:**

- **Self-Documenting:** Comments are PROHIBITED. Code must explain the "WHY" through naming and structure.
- **Control Flow:** Mandatory use of **Early Returns** (Guard Clauses) to eliminate nesting. Complex `if/else` blocks are prohibited; prioritize `if/return`.
- **Declarative over Imperative:** Prioritize functional patterns (`.map()`, `.filter()`, `.reduce()`) over `for/while` loops.
- **Naming:** Ultra-descriptive naming. **Avoid Primitive Obsession:** Use _Branded Types_ or _Discriminated Unions_ for states and IDs.

**2. SOLID & Functional Architecture:**

- **SRP & Composition:** One logic, one file. Composition over inheritance. Extract complex logic into pure, stateless utilities.
- **Dependency Injection:** Inject services into logic. Business logic must be side-effect-free and 100% testable.
- **Type Safety:** Strict use of _Discriminated Unions_. Implement **Exhaustive Checks** using the `never` type in `switch/default` blocks.

**3. Performance Engineering:**

- **Complexity:** $O(n^2)$ operations on collections are prohibited. Use `Map` or `Set` for $O(1)$ lookups.
- **Data Fetching:** Prevent N+1 patterns. Use batching or `Promise.all` for independent operations.
- **Memory:** Avoid unnecessary object spreading in critical loops. Prioritize _lazy evaluation_ and memoization (`useMemo`, `cache`).

**4. Resilience, Security & Observability:**

- **Fail Fast:** Validate all inputs at the boundary (Zod/Middleware). Use **Result Patterns** (Success/Failure objects) instead of exceptions for expected business errors.
- **Idempotency:** All mutations must be idempotent. Use DB transactions for multi-step operations.
- **Telemetry:** Structural logging in every `catch` block (IDs, context, error code). Errors must always be typed.
- **Security-by-Default:** Sanitize all outputs. Use `unknown` over `any`. Force `readonly` by default.

### [rule: architecture-hexagonal]

**Backend ONLY:** Strict structure (Domain -> Application -> Infrastructure). Domain must have zero external dependencies. Use optimistic locking via `version` or `updated_at`.

---

## ⚡ User Skills (Trigger Mapping)

| Context                                  | Triggers                                                                           |
| :--------------------------------------- | :--------------------------------------------------------------------------------- |
| Any code modification or refactoring     | `[rule: global-code-quality]`, `typescript`                                        |
| Backend logic, APIs, or DB interactions  | `clean-ddd-hexagonal`, `[rule: architecture-hexagonal]`, `security-best-practices` |
| Frontend UI, components, or state        | `react-19`, `tailwind-4`, `zustand-5`, `zod-4`                                     |
| Error diagnosis or bug investigation     | `systematic-debugging`, `error-handling-patterns`                                  |
| Creating unit, integration, or E2E tests | `backend-testing`, `playwright`                                                    |
