# Pixel Mentor

## Monorepo Map

- **Backend**: `apps/api/` (@pixel-mentor/api)
- **Frontend**: `apps/web/` (@pixel-mentor/web)
- **Shared**: `packages/shared/`
- **Tests**: Alongside source (`*.spec.ts`, `*.test.ts`).

## Terminal & Execution Protocols

- **Anti-Noise Policy**: PROHIBITED massive log dumping. ALWAYS pipe long outputs: `| head -n 50`.
- **Targeted Execution**: PROHIBITED running global suites. Use `--filter` or target specific files.
- **Sequential Batching**: Execute bash commands in logical sequences to prevent terminal lockups.

### Command Quick-Ref

| Task      | Backend Command                                                | Frontend Command                                 |
| :-------- | :------------------------------------------------------------- | :----------------------------------------------- |
| Lint      | `pnpm --filter @pixel-mentor/api lint`                         | `pnpm --filter @pixel-mentor/web lint`           |
| Typecheck | `pnpm --filter @pixel-mentor/api typecheck`                    | `pnpm --filter @pixel-mentor/web typecheck`      |
| Test      | `pnpm --filter @pixel-mentor/api test -- <file>`               | `pnpm --filter @pixel-mentor/web test -- <file>` |
| DB Ops    | `pnpm --filter @pixel-mentor/api db:[generate\|push\|migrate]` | N/A                                              |

## Agentic Workflow (Orchestrator Logic)

- **Planning**: MANDATORY: Every response MUST start with `[Audit/Plan]: <logical step>`.
- **Read Logic**: PROHIBITED reading files >200 lines. Extract skeleton first: `grep -E '^(import|export|class|function|interface)'`.
- **Delegation**: Use `delegate` for parallel/background triage. Use `task` for blocking synchronous needs.
- **Context Integrity**: PROHIBITED scope drift. If a task is "Fix A", do not refactor "B" unless explicitly ordered.

## Project Conventions

- **Naming:** Files: `kebab-case`. Components: `PascalCase`. Constants: `SCREAMING_SNAKE_CASE`.
- **Imports:** Absolute only via `@/` alias.
- **Commits:** English, Conventional Commits format.

## Stack & Architecture Map

- **Frontend**: React 19, Zustand 5, Tailwind 4. (No Next.js).
- **Backend**: Node.js, Express 5, Prisma. Hexagonal Architecture (Domain/Application/Infrastructure).
- **Quality**: Rules for code excellence are delegated to the `.atl/skill-registry.md`.

## Git & Delivery Protocol

- **Pre-flight**: MANDATORY `lint` and tests in the affected workspace BEFORE committing.
- **Commits**: English ONLY. Conventional Commits (`feat:`, `fix:`, `chore:`). Atomic logical groups.
- **Security**: PROHIBITED secrets in stage. Use `.env` files only.
