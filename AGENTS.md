# Pixel Mentor - AI Routing Protocol

<monorepo_map>

- Backend (Express/Prisma): `apps/api/`
- Frontend (React/Zustand): `apps/web/`
- Shared Types/Schemas: `packages/shared/`
- Tests: Located alongside source files as `*.spec.ts` or `*.test.ts`.
  </monorepo_map>

<routing_manifest>
CRITICAL: Map your task to the exact domain below. Use `mcp:filesystem` to read ONLY the corresponding file(s) BEFORE starting Phase 1. Do NOT bulk read.

[DOMAIN: Architecture, Stack & Database]

- Target Files: `docs/ai/01-architecture-and-stack.md`, `apps/api/prisma/schema.prisma`

[DOMAIN: Coding Standards & UI Conventions]

- Target File: `docs/ai/02-coding-standards.md`

[DOMAIN: PRD - Product Logic & Core]

- Target File: `docs/PRD.md`

  </routing_manifest>

<terminal_protocols>
CRITICAL: Use these EXACT commands in your <scratchpad> planning for Phase 2 validation. Do NOT run global suites. Target specific files.

- Linting: `pnpm lint`
- Type Checking (Backend): `pnpm --filter @pixel-mentor/api typecheck`
- Unit Testing: `pnpm --filter @pixel-mentor/api test -- --testPathPattern="{exact_filename}"`
- Prisma Generation: `pnpm --filter @pixel-mentor/api db:generate`

</terminal_protocols>
