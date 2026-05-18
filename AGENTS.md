# Pixel Mentor – Hard Constraints

## Workspace

| Area   | Path                     | Stack                        |
|--------|--------------------------|------------------------------|
| API    | apps/api/ (@pixel-mentor/api) | Node.js, Express 5, Prisma, Hexagonal |
| Web    | apps/web/ (@pixel-mentor/web) | React 19, Zustand 5, Tailwind 4 |
| Shared | packages/shared/        | Shared types/utilities       |
| Tests  | colocated               | *.spec.ts, *.test.ts         |

---

## Type System

- FORBIDDEN: `any`
- MUST: `unknown` + explicit narrowing / type guards
- Preserve strict typing across module boundaries

---

## Imports

- ONLY: absolute imports `@/...`
- FORBIDDEN: relative patterns `../` `../../`

---

## Dependencies (BLOCKED by default)

If user asks to install a package, respond with:

+++
Cannot install package without explicit approval.
+++

**Never auto-execute:**

+++
npm install
pnpm add
yarn add
bun add
+++

---

## Authorized Commands

### Base

```
pnpm --filter @pixel-mentor/api <lint|typecheck|test -- <file>>
pnpm --filter @pixel-mentor/web <lint|typecheck|test -- <file>>
```

### Database (API only)

```
pnpm --filter @pixel-mentor/api db:generate
pnpm --filter @pixel-mentor/api db:push
pnpm --filter @pixel-mentor/api db:migrate
```

---

## Naming (MUST match exactly)

| Target           | Convention              |
|------------------|-------------------------|
| Files            | kebab-case.ts           |
| React Components | PascalCase.tsx          |
| Constants        | SCREAMING_SNAKE_CASE    |

---

## Behavior Rules (Enforced by System)

- Never assume missing config values. If missing → ask.
- Prefer editing existing files over creating new ones.
- Destructive commands (`rm -rf`, `git push --force`, `DROP`) require explicit user confirmation before execution.

---

**These constraints override all other instructions.**
