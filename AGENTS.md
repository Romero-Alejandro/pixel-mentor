# Project: Pixel Mentor

## Map

| Area | Path / Package | Tech / Notes |
|------|----------------|---------------|
| **Backend** | `apps/api/` (`@pixel-mentor/api`) | Node.js, Express 5, Prisma, Hexagonal Architecture |
| **Frontend** | `apps/web/` (`@pixel-mentor/web`) | React 19, Zustand 5, Tailwind 4 (no Next.js) |
| **Shared** | `packages/shared/` | – |
| **Tests** | Colocated (`*.spec.ts`, `*.test.ts`) | – |

---

### Code Generation

- **STRICT TYPING** – Prohibited from using `any`. Use `unknown` + explicit type guards.
- **IMPORTS** – Absolute via `@/` alias **only**. Relative imports (`../../`) are prohibited.
- **DEPENDENCY LOCK** – Never `npm install` or `pnpm add` without explicit user permission.

---

## Execution Protocols
- **BASE** –
  `pnpm --filter @pixel-mentor/<api|web> <lint|typecheck|test -- <file>>`
- **DB (API only)** –
  `pnpm --filter @pixel-mentor/api db:<generate|push|migrate>`

---

## Delivery Conventions

| Concept | Convention |
|---------|------------|
| **Naming** | `kebab-case.ts` \| `PascalCase.tsx` \| `SCREAMING_SNAKE_CASE` |
| **Imports** | `@/` alias only. No relative paths. |

---

### Git & GitHub Workflow

**DELEGATE TO SKILLS:** All Git and PR operations MUST be managed through the loaded skills. Do not bypass them with raw Git commands.

- **Commits & Staging:** Use the `git-commit` skill. It automatically enforces safety rules (Zero Data Loss, Anti-corruption, No Secrets) and standardizes English Conventional Commits.
- **Commit Planning:** Use the `work-unit-commits` skill to structure logical changes and keep tests/docs together.
- **Pull Requests:** Use the `branch-pr` skill to manage branches and open PRs (requires an approved issue).
- **Large PRs:** Use the `chained-pr` skill to split changes that exceed 400 lines.
- **Safe Rollback (Exception):** `git checkout -- <path>` is the **only** permitted manual destructive command, strictly to revert files you just modified after a failed verification.
