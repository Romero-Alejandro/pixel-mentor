<!-- project:pixel-mentor -->

<project_map>
Backend:  apps/api/ (@pixel-mentor/api) | Node.js, Express 5, Prisma | Hexagonal Architecture
Frontend: apps/web/ (@pixel-mentor/web) | React 19, Zustand 5, Tailwind 4 | NO Next.js
Shared:   packages/shared/
Tests:    Colocated (*.spec.ts, *.test.ts)
Standards: .atl/skill-registry.md
</project_map>

<execution_protocols>
- NOISE CONTROL: NEVER dump raw output. ALWAYS pipe: | head -n 50
- TARGETING: NEVER run global suites. ALWAYS target file or workspace.
- BASE: pnpm --filter @pixel-mentor/<api|web> <lint|typecheck|test -- <file>>
- DB (API only): pnpm --filter @pixel-mentor/api db:<generate|push|migrate>
</execution_protocols>

<shared_guardrails target="all-agents">

  <navigation_and_reading>
  - STRUCTURAL READING: NEVER read files >200 lines directly.
    1. wc -l {file}
    2. grep -E '^\s*(import|export|class|interface|type|function|const [A-Z]|@)' {file}
    3. grep -n -C 20 "targetSymbol" {file}
  - DB SCHEMA: MUST read schema.prisma BEFORE any repository query. NEVER guess models or fields.
  - BLIND IMPORTS: NEVER guess paths. grep -rn "export.*Symbol" src/ first.
  - CIRCUIT BREAKER: grep returns nothing → trace from root or STOP. No blind variations.
  </navigation_and_reading>

  <git_workflow>
  - ZERO DATA LOSS: NEVER use git restore, git checkout --, git reset --hard, or git stash drop
    to bypass errors. Uncommitted work > task completion. If stuck: STOP and report.
  - ANTI-CORRUPTION: NEVER run rm -f .git/index.lock. Lock = another process writing.
    Wait 5s and retry, or STOP.
  - ATOMIC STAGING: git add and git commit MUST be ONE bash call:
    git add <files> && git commit -m "type(scope): subject"
  - PRE-COMMIT (in order): git diff → lint → typecheck → test → commit. All must pass.
  - LOCAL ONLY: NEVER git push, pull, fetch, or any remote op.
  - NO SECRETS: NEVER stage .env or keys. If accidental: git restore --staged <file> immediately.
  - COMMITS: English only. Conventional Commits. Valid types: feat|fix|refactor|docs|chore|test|perf
    One logical change per commit. feat(docs) or mixed types = invalid.
  </git_workflow>

</shared_guardrails>

<executor_guardrails target="sys-coder,sys-refactor,sys-triage">

  <code_generation>
  - ANTI-ELISION: NEVER use // ... rest of the code. Output the complete functional block.
  - STRICT TYPING: PROHIBITED from using any. Use unknown + explicit type guards.
  - ZERO COMMENTS: No explanatory comments, TODOs, or FIXMEs. Name things descriptively instead.
  - IMPORTS: Absolute via @/ alias ONLY. Relative imports (../../) are prohibited.
  - DEPENDENCY LOCK: NEVER npm install or pnpm add without explicit user permission.
  </code_generation>

  <hexagonal_strictness>
  CONTROLLERS (apps/api/src/**/controllers/):
    → HTTP only: request parsing, DTO validation, response, status codes.
    → PROHIBITED: Prisma imports, direct repository calls, business logic.
  SERVICES (apps/api/src/**/services/):
    → Business logic and use-case orchestration only.
    → PROHIBITED: Express imports (req/res/next), PrismaClient imports.
  REPOSITORIES (apps/api/src/**/repositories/):
    → ONLY layer allowed to import and use PrismaClient.
    → PROHIBITED: business logic, HTTP concerns.
  Boundary violation → STOP. Report as architectural blocker. Do NOT force the change.
  </hexagonal_strictness>

  <error_recovery>
  - TEST FAILURES: Isolate and patch ONLY the failing condition. NEVER rewrite the whole file.
  - 3-STRIKE RULE: Bug persists after 2 attempts → STOP. Envelope: STATUS: BLOCKED. Architectural Failure.
  - VERIFICATION: NEVER declare success without showing lint/typecheck/test output in the envelope.
  </error_recovery>

</executor_guardrails>

<delivery_conventions>
Naming:  kebab-case.ts | PascalCase.tsx | SCREAMING_SNAKE_CASE
Imports: @/ alias only. No relative paths.
Styling: Tailwind 4 utilities only. No inline styles. No CSS modules unless pre-existing.
State:   Zustand 5 (global) | useState (component-scoped ephemeral only).
</delivery_conventions>

<!-- /project:pixel-mentor -->
