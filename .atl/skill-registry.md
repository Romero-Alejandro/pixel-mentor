# Skill Registry - Pixel Mentor

**Última actualización:** 2026-04-17

## Project Skills

| Skill                            | Descripción                                    | Trigger                                 |
| -------------------------------- | ---------------------------------------------- | --------------------------------------- |
| webapp-testing                   | Testing de aplicaciones web con Playwright     | testing, verificación UI, screenshots   |
| api-design-principles            | Principios de diseño REST/GraphQL              | diseño de APIs                          |
| supabase-postgres-best-practices | Optimización de Postgres/Supabase              | queries, schema, base de datos          |
| error-handling-patterns          | Patrones de manejo de errores                  | errores, excepciones, resiliencia       |
| vercel-react-best-practices      | Optimización React/Next.js                     | componentes React, Next.js, performance |
| backend-testing                  | Tests backend (Jest, integration, API)         | tests, testing, coverage                |
| security-best-practices          | Seguridad web (OWASP, HTTPS, CORS, etc)        | seguridad, protección                   |
| systematic-debugging             | Debugging sistemático                          | bugs, errores, debugging                |
| brainstorming                    | Lluvia de ideas antes de trabajo creativo      | crear features, nuevos componentes      |
| interface-design                 | Diseño de interfaces (dashboards, apps, tools) | interfaces, UI, UX                      |

## SDD Skills

| Skill       | Descripción                         | Trigger                 |
| ----------- | ----------------------------------- | ----------------------- |
| sdd-init    | Inicializar SDD en proyecto         | sdd init, openspec init |
| sdd-explore | Explorar ideas antes de implementar | /sdd-explore            |
| sdd-propose | Crear propuesta de cambio           | /sdd-new                |
| sdd-spec    | Escribir especificaciones           | specs, requisitos       |
| sdd-design  | Diseño técnico                      | arquitectura, diseño    |
| sdd-tasks   | Descomponer en tareas               | tareas, checklist       |
| sdd-apply   | Implementar código                  | implementación          |
| sdd-verify  | Verificar implementación vs specs   | verificar, tests        |
| sdd-archive | Archivar cambio completado          | archivar                |

## Compact Rules

### issue-creation

**Description**: Issue creation workflow for Agent Teams Lite following the issue-first enforcement system.
**Compact Rules**:

1. Blank issues are disabled — MUST use a template (bug report or feature request)
2. Every issue gets `status:needs-review` automatically on creation
3. A maintainer MUST add `status:approved` before any PR can be opened
4. Questions go to Discussions, not issues

### branch-pr

**Description**: PR creation workflow for Agent Teams Lite following the issue-first enforcement system.
**Compact Rules**:

1. Every PR MUST link an approved issue — no exceptions
2. Every PR MUST have exactly one `type:*` label
3. Automated checks must pass before merge is possible
4. Blank PRs without issue linkage will be blocked by GitHub Actions

### skill-creator

**Description**: Creates new AI agent skills following the Agent Skills spec.
**Compact Rules**:

1. Create a skill when a pattern is used repeatedly and AI needs guidance
2. Don't create a skill when documentation already exists or pattern is trivial
3. Skill structure: `skills/{skill-name}/SKILL.md` with optional `assets/` and `references/`
4. Always add the skill to `AGENTS.md`

### go-testing

**Description**: Go testing patterns for Gentleman.Dots, including Bubbletea TUI testing.
**Compact Rules**:

1. Use table-driven tests for multiple test cases
2. Test Bubbletea Model state transitions directly
3. Use Charmbracelet's teatest for TUI testing
4. Compare output against saved "golden" files for visual output testing

### judgment-day

**Description**: Parallel adversarial review protocol that launches two independent blind judge sub-agents simultaneously to review the same target, synthesizes their findings, applies fixes, and re-judges until both pass or escalates after 2 iterations.
**Compact Rules**:

1. Launch TWO sub-agents via `delegate` (async, parallel)
2. Each agent receives the same target but works independently
3. Neither agent knows about the other — no cross-contamination
4. Both use identical review criteria but may find different issues

## Conventions

### Stack Detectado

- **Monorepo:** pnpm workspaces + turbo
- **Backend:** Express/Prisma
- **Frontend:** React/Zustand
- **Testing:** Jest, Vitest, Playwright
- **TypeScript:** 5.9.3

### Protocolos de Terminal

- Linting: `pnpm lint`
- Type Checking (Backend): `pnpm --filter @pixel-mentor/api typecheck`
- Unit Testing: `pnpm --filter @pixel-mentor/api test -- --testPathPattern="{exact_filename}"`
- Prisma Generation: `pnpm --filter @pixel-mentor/api db:generate`

### Rutas Importantes

- Estándares/Arquitectura: `AGENTS.md`
- Schema DB: `apps/api/prisma/schema.prisma`
- PRD: `docs/PRD.md`
