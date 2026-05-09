# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

---

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| When writing React components | react-19 | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/react-19/SKILL.md |
| When styling with Tailwind | tailwind-4 | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/tailwind-4/SKILL.md |
| When designing APIs, microservices, or scalable backend structure | clean-ddd-hexagonal | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/clean-ddd-hexagonal/SKILL.md |
| When scaffolding or organizing files for APIs, microservices, or scalable backend structures | clean-ddd-hexagonal-structure | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/clean-ddd-hexagonal-structure/SKILL.md |
| When using Zod for validation | zod-4 | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/zod-4/SKILL.md |
| When writing TypeScript code | typescript | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/typescript/SKILL.md |
| When managing React state with Zustand | zustand-5 | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/zustand-5/SKILL.md |
| When testing local web applications using Playwright | webapp-testing | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/webapp-testing/SKILL.md |
| When testing REST APIs, database operations, authentication flows, or business logic | backend-testing | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/backend-testing/SKILL.md |
| When writing, reviewing, or optimizing Postgres queries, schema designs, or database configurations | supabase-postgres-best-practices | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/supabase-postgres-best-practices/SKILL.md |
| When securing APIs, preventing common vulnerabilities, or implementing security policies | security-best-practices | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/security-best-practices/SKILL.md |
| When designing dashboards, admin panels, apps, tools, and interactive products | interface-design | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/interface-design/SKILL.md |
| When implementing error handling, designing APIs, or improving application reliability | error-handling-patterns | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/error-handling-patterns/SKILL.md |
| When designing new APIs, reviewing API specifications, or establishing API design standards | api-design-principles | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/api-design-principles/SKILL.md |
| When creating, opening, or preparing PRs for review | branch-pr | /home/alejandro/.config/opencode/skills/branch-pr/SKILL.md |
| When creating GitHub issues, bug reports, or feature requests | issue-creation | /home/alejandro/.config/opencode/skills/issue-creation/SKILL.md |
| When writing warm, direct collaboration comments | comment-writer | /home/alejandro/.config/opencode/skills/comment-writer/SKILL.md |
| When designing docs that reduce cognitive load | cognitive-doc-design | /home/alejandro/.config/opencode/skills/cognitive-doc-design/SKILL.md |
| When planning commits as reviewable work units | work-unit-commits | /home/alejandro/.config/opencode/skills/work-unit-commits/SKILL.md |
| When saving code to local history | git-commit | /home/alejandro/.config/opencode/skills/git-commit/SKILL.md |

---

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### react-19
- No useMemo/useCallback — React Compiler handles memoization automatically
- use() hook for promises/context, replaces useEffect for data fetching
- Server Components by default, add 'use client' only for interactivity/hooks
- ref is a regular prop — no forwardRef needed
- Actions: use useActionState for form mutations, useOptimistic for optimistic UI
- Metadata: export metadata object from page/layout, no <Head> component

### tailwind-4
- Use `cn()` from `class-variance-authority` for conditional classes
- Theme variables via `theme()` function, not `var(--)` in className
- Arbitrary values: `bg-[#rgb]` or `w-[200px]` — avoid inline styles
- Dark mode: `dark:{class}` prefix, not manual toggles
- Responsive: `md:{class}` syntax, mobile-first

### clean-ddd-hexagonal
- Domain layer: pure business logic, no frameworks
- Application layer: use cases, orchestration, no DB/HTTP
- Infrastructure layer: adapters for DB, APIs, external services
- Dependencies flow inward: Domain → Application → Infrastructure
- Ports (interfaces) in Domain/Application, Adapters (implementations) in Infrastructure

### clean-ddd-hexagonal-structure
- Feature-sliced: `src/{feature}/` over `src/{layer}/{feature}/`
- Layer boundaries: `domain/`, `application/`, `infrastructure/` within each feature
- File naming: `{entity}.model.ts`, `{use-case}.service.ts`, `{adapter}.{tech}.ts`
- Exports: index.ts per feature, no circular deps
- Prisma: schema.prisma in infrastructure, generate client in domain

### zod-4
- `z.coerce` for runtime type conversion (e.g., strings to numbers)
- `.pipe()` for chaining transformations
- `.catch()` for default values on parse errors
- `.superRefine()` for cross-field validation
- `.brand()` for nominal types

### typescript
- `unknown` over `any` — always add type guards
- `satisfies` for complex object literals
- Template literal types for string unions
- `as const` for readonly tuples/objects
- `@satisfies` JSDoc for external libs

### zustand-5
- `create()` with implicit store type inference
- Slices: `create<Store>()((set) => ({ ... }))`
- Middleware: `devtools` + `persist` by default
- Selectors: `useStore(state => state.value)`
- Actions: define methods in the store, not external helpers

### webapp-testing
- Playwright: `page.locator()` over `page.$()`
- Auto-waiting: Playwright waits for elements by default
- Network: `page.waitForResponse()` for API calls
- Fixtures: `test.describe.configure({ mode: 'parallel' })`
- Screenshots: `expect(locator).toHaveScreenshot()`

### backend-testing
- Jest: `describe()`, `test()`, `expect()`
- Mocking: `jest.mock()` for modules, `jest.fn()` for functions
- API tests: `supertest` for HTTP endpoints
- DB tests: transaction rollback or test containers
- Coverage: `--coverage --collectCoverageFrom='src/**/*.ts'`

### supabase-postgres-best-practices
- Indexes: `CREATE INDEX CONCURRENTLY` for production
- JSON: `jsonb` over `json`, use `@>` for containment
- Partitions: by time/ID for large tables
- CTIDs: avoid, use natural keys
- Explain: `ANALYZE table` after bulk loads

### security-best-practices
- CORS: explicit origins, no wildcards
- Helmet: `helmet()` middleware for Express
- Rate limiting: `express-rate-limit`
- Secrets: never in code, use `.env` + `dotenv`
- CSRF: `csurf` for forms

### interface-design
- Layout: 12-column grid, 8px baseline
- Typography: `rem` units, max 75 chars/line
- Colors: WCAG AA contrast, avoid red/green
- States: hover, focus, active, disabled
- Mobile: touch targets ≥ 48x48px

### error-handling-patterns
- Express: async wrapper for route handlers
- Results: `Result<T, E>` type for explicit errors
- Logging: structured logs with `error` level
- Retries: exponential backoff for transient errors
- Fallbacks: graceful degradation paths

### api-design-principles
- REST: nouns for resources, HTTP methods for actions
- GraphQL: queries for reads, mutations for writes
- Versioning: `/v1/resource` in URL
- Pagination: `?page=1&limit=10`
- Filtering: `?filter[key]=value`

### branch-pr
- Issue-first: always link to a GitHub issue
- Title: `<type>(<scope>): <description>`
- Body: `## Summary`, `## Changes`, `## Notes`
- Labels: `type:feature`, `type:bug`, etc.
- Reviewers: assign 1-2, never >3

### issue-creation
- Title: clear, actionable, <50 chars
- Body: `## Description`, `## Steps`, `## Expected`
- Labels: `bug`, `enhancement`, `question`
- Assignees: optional, never auto-assign
- Milestone: only if known

### comment-writer
- Tone: warm, direct, collaborative
- Structure: context → question/feedback → suggestion
- Emojis: 👍/🎉 sparingly, never 😂/🔥
- Length: <100 words, break into threads if longer
- Links: reference lines/files with GitHub syntax

### cognitive-doc-design
- Headings: hierarchical, max 3 levels
- Lists: bullet points over paragraphs
- Code: fenced blocks with language tags
- Diagrams: Mermaid.js for flowcharts
- Length: <1 screen per section

### work-unit-commits
- Scope: one logical change per commit
- Message: `feat(api): add user endpoint`
- Body: `BREAKING CHANGE:` if applicable
- Tests: include related tests in same commit
- Docs: update READMEs in same commit

### git-commit
- Type: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Scope: `(api)`, `(web)`, `(shared)`
- Subject: <50 chars, lowercase, no period
- Body: `why` over `what`, wrap at 72 chars
- Footer: `Closes #123` if applicable

---

## Project Conventions

| File | Path |
|------|------|
| AGENTS.md | /home/alejandro/dev/projects/active/pixel-mentor/AGENTS.md |
| clean-ddd-hexagonal | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/clean-ddd-hexagonal/SKILL.md |
| clean-ddd-hexagonal-structure | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/clean-ddd-hexagonal-structure/SKILL.md |
| react-19 | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/react-19/SKILL.md |
| tailwind-4 | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/tailwind-4/SKILL.md |
| zod-4 | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/zod-4/SKILL.md |
| typescript | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/typescript/SKILL.md |
| zustand-5 | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/zustand-5/SKILL.md |
| webapp-testing | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/webapp-testing/SKILL.md |
| backend-testing | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/backend-testing/SKILL.md |
| supabase-postgres-best-practices | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/supabase-postgres-best-practices/SKILL.md |
| security-best-practices | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/security-best-practices/SKILL.md |
| interface-design | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/interface-design/SKILL.md |
| error-handling-patterns | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/error-handling-patterns/SKILL.md |
| api-design-principles | /home/alejandro/dev/projects/active/pixel-mentor/.agents/skills/api-design-principles/SKILL.md |
| branch-pr | /home/alejandro/.config/opencode/skills/branch-pr/SKILL.md |
| issue-creation | /home/alejandro/.config/opencode/skills/issue-creation/SKILL.md |
| comment-writer | /home/alejandro/.config/opencode/skills/comment-writer/SKILL.md |
| cognitive-doc-design | /home/alejandro/.config/opencode/skills/cognitive-doc-design/SKILL.md |
| work-unit-commits | /home/alejandro/.config/opencode/skills/work-unit-commits/SKILL.md |
| git-commit | /home/alejandro/.config/opencode/skills/git-commit/SKILL.md |

---

## Notes
- **Compact Rules**: Delegators MUST inject matching rules into sub-agent prompts.
- **Paths**: All paths are absolute for direct use by sub-agents.
- **Updates**: Re-run this skill after installing/removing skills or changing conventions.
- **Exclusions**: SDD workflow skills (`sdd-*`) are omitted — they are handled by the orchestrator.
