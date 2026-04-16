# Pixel Mentor - Core Directives

## Monorepo Map

- Backend: `apps/api/`
- Frontend: `apps/web/`
- Shared: `packages/shared/`
- Tests: Alongside source (`*.spec.ts`, `*.test.ts`, `*.test.tsx`).

## Terminal Protocols

- Terminal Output Control: PROHIBITED massive log dumping. Pipe commands that might output large text arrays (like `npm install` or massive test failures) through truncators (e.g., `| head -n 50` or `| tail -n 50`). Keep the signal-to-noise ratio high.
PROHIBITED: Global test/lint suites. Target specific packages/files.

### Backend (@pixel-mentor/api)

- Lint: `pnpm --filter @pixel-mentor/api lint`
- Typecheck: `pnpm --filter @pixel-mentor/api typecheck`
- Unit Test (Jest): `pnpm --filter @pixel-mentor/api test -- <filename>`
- DB Generate: `pnpm --filter @pixel-mentor/api db:generate`
- DB Push: `pnpm --filter @pixel-mentor/api db:push`
- DB Migrate: `pnpm --filter @pixel-mentor/api db:migrate`

### Frontend (@pixel-mentor/web)

- Lint: `pnpm --filter @pixel-mentor/web lint`
- Typecheck: `pnpm --filter @pixel-mentor/web typecheck`
- Unit Test (Vitest): `pnpm --filter @pixel-mentor/web test -- <filename>`
- E2E Test (Playwright): `pnpm --filter @pixel-mentor/web test:e2e`

## Architecture & Stack

- Structure: Both Frontend and Backend divided by FEATURES.
- Frontend: React 19 (Vite), Zustand, Tailwind 4, React Router, React Query, Rive. PROHIBITED: Next.js.
- Backend: Node.js, Express 5, PostgreSQL, Prisma, Pino (logging). ONLY Backend uses Hexagonal Architecture.
- Hexagonal Rules (Backend ONLY): `domain/` (zero deps), `application/` (use cases), `infrastructure/` (adapters).

## Database & Security

- Locking: Optimistic via `version` / `updated_at`.
- Auth/Crypto: Argon2id hashes, JWT.
- Validation: Zod strict on Request/Response.
- Concurrency: PostgreSQL advisory locks via `session_id`.

## Coding Standards

- TS: `readonly` default. Discriminated unions. PROHIBITED: `any`. Use `unknown`.
- Imports: Mandatory `@/` alias.
- Naming: Files `kebab-case`. Components `PascalCase`. Hooks `camelCase`. Constants `SCREAMING_SNAKE_CASE`.

## Commenting Policy

- Rule: Focus on "WHY", not "WHAT".
- Documentation: JSDoc for public exports.
- Code Hygiene: PROHIBITED: Commented-out code.
- Technical Debt: Tag `TODO:` or `FIXME:` + context.

## Excellence & Development Quality

- SOLID: SRP strictly. One logic per file.
- Fail Fast: Validate early via Guard Clauses and Zod.
- Error Handling: Use custom Error classes. PROHIBITED: Generic `Error`.
- Performance: O(n²) prohibited on large datasets. Use Map/Set for O(1) lookups.
- Readability: Descriptive names > Short names.

## Agentic Workflow & Routing

MANDATORY: Always start with the `[Audit/Plan]` line as defined in Global Directives.

- Sub-Agent Execution: Use `delegate` (async) for background tasks (e.g., parallel Specs and Design). Use `task` (sync) ONLY if result is required for the immediate next step.
- Terminal Execution: Batch bash commands logically. Execute SEQUENTIALLY to prevent terminal lockups.
- Read Before Write (Skeleton-of-Thought): PROHIBITED blind edits and PROHIBITED reading full files (>200 lines) immediately.
  1. Extract the file skeleton first (e.g., using `grep -E '^(class|function|const|export)'` or similar AST/regex tools) to map the API surface.
  2. Isolate the target block.
  3. Read ONLY the isolated block, modify it, and write it back. Verify syntax and existing symbols to prevent duplication.
- Context Retention: PROHIBITED orphan refactors or scope drift.
- Dynamic Context: Use `mcp:filesystem` for `docs/PRD.md` ONLY for core logic changes.

## Git Protocol

- Pre-Validation: MANDATORY. Run `lint` and tests ONLY in affected workspace (@pixel-mentor/api or web) BEFORE commit.
- Language: English ONLY.
- Format: Conventional Commits (`feat:`, `fix:`, `chore:`).
- Security: PROHIBITED secrets/tokens in stage.
- Behavior: Atomic logical groups. One commit per isolated fix. PROHIBITED mass/WIP commits.

### Mechanical Safety Protocol (Anti-Hallucination)
- Zero-Hallucination Edits: PROHIBITED rewriting entire files (>300 lines) for minor changes. Map block scopes before touching nested logic.
- Post-Edit Verification: MANDATORY execution of target-specific `typecheck` or `lint` on edited `*.ts/tsx` files BEFORE responding or committing.
- Syntax Error Fallback: If compiler throws syntax errors (e.g., unbalanced brackets), PROHIBITED guessing based on log line. Inspect preceding block structures using text search to trace the unclosed scope.

## Diagnostic & Debugging Protocol (Anti-Loop System)

When encountering a bug, error log, or 404/500 HTTP response, you MUST follow this precise reasoning protocol BEFORE executing any file search or terminal command.

1. **Stop & Think [Diagnostic Plan]:** You are PROHIBITED from using `grep`, `glob`, or random file searches immediately. You must write a brief `[Diagnostic Plan]` analyzing the logical flow.
2. **Smart Stack Trace Reading:** PROHIBITED from focusing only on the top line of an error stack. You MUST scan down the stack trace to find the FIRST line that originates from the project's `src/` directory. Ignore `node_modules` or framework internal errors.
3. **Top-Down Tracing Paths:**
   - **Backend (HTTP/API):** DO NOT search globally. Trace: `main/routes.ts` -> Specific Module Router (`features/.../routes.ts`) -> Controller -> Application Use Case.
   - **Frontend (UI/State):** DO NOT search globally. Trace: App Router Config -> Target Page/View -> Container Component -> Zustand Store / React Query Hook.
4. **Reproduce Before Fix (Test-Driven Debugging):** For logical or data transformation bugs, you MUST attempt to write a failing unit test (`*.test.ts` or `*.spec.ts`) that reproduces the exact error BEFORE modifying the source code. Use the test runner output to mechanically guide your fix.
5. **Anti-Loop Circuit Breaker:** If you execute a search command (e.g., `glob`, `grep`) and it fails to find the target, you are PROHIBITED from running variations of the same command. You MUST change your strategy, trace from the application root, or halt and explicitly ask the user for domain context.
6. **Time Context:** Look at response times in logs. A `1ms` response on a 404 means the router rejected it before any logic ran. A `5000ms` response means a database timeout or infinite loop. Use this data.
