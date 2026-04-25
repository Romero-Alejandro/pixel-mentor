<project_map>
- Backend: `apps/api/` (@pixel-mentor/api) | Node.js, Express 5, Prisma (Hexagonal Architecture)
- Frontend: `apps/web/` (@pixel-mentor/web) | React 19, Zustand 5, Tailwind 4 (NO Next.js)
- Shared: `packages/shared/`
- Tests: Colocated (`*.spec.ts`, `*.test.ts`)
- Quality Standards: See `.atl/skill-registry.md`
</project_map>

<execution_protocols>
- NOISE CONTROL: NEVER dump massive logs. MUST pipe: `| head -n 50`.
- TARGETING: NEVER run global suites. MUST target specific files or use `--filter`.
- BASE COMMANDS: `pnpm --filter @pixel-mentor/<api|web> <lint|typecheck|test -- file>`
- DB OPS (API ONLY): `pnpm --filter @pixel-mentor/api db:<generate|push|migrate>`
</execution_protocols>

<shared_guardrails target="all-agents">
    <navigation_and_reading>
    - STRUCTURAL READING: NEVER read files >200 lines blindly. Extract skeleton first via `grep`.
    - DB SCHEMA: MUST read `schema.prisma` before querying repositories. NEVER guess models.
    - BLIND IMPORTS: NEVER guess import paths. If unsure, `grep` exports first.
    </navigation_and_reading>

    <git_workflow>
    - ZERO DATA LOSS: NEVER use `git restore <file>`, `git checkout -- <file>`, `git reset --hard`, or `git stash drop` to bypass an error or "clean" the workspace. Preserving uncommitted work is infinitely more important than completing a task. If stuck, STOP and report the error.
    - ANTI-CORRUPTION: STRICTLY PROHIBITED from executing `rm -f .git/index.lock`. If you hit a lock error, it means another process is writing. Wait 5 seconds and retry, or STOP. Do NOT delete lock files.
    - CHAINING REQUIREMENT: To prevent `index.lock` collisions, you MUST read changes FIRST (`git diff <files>`), mentally generate the commit message, and THEN execute staging and committing in a SINGLE bash call: `git add <files> && git commit -m "..."`. NEVER run `git add` and `git commit` in separate tool calls.
    - LOCAL ONLY: STRICTLY PROHIBITED from `git push`, `pull`, `fetch`, or `remote`.
    - PRE-COMMIT: MUST run `git diff` before staging. NEVER blindly use `git add .`.
    - NO SECRETS: NEVER stage `.env` or keys. If accidental, immediately `git restore --staged <file>`.
    - ATOMIC COMMITS: Group changes into logical units.
    - COMMIT MESSAGES: English ONLY. Follow Conventional Commits strictly (`type(scope): subject`). Use the CORRECT type (`feat` for new features, `fix` for bugs, `docs` for documentation, `chore` for maintenance). Never mix them (e.g., `feat(docs)` is invalid).
    </git_workflow>
</shared_guardrails>

<executor_guardrails target="sub-agents">
    <code_generation>
    - ANTI-ELISION: NEVER use comments like `// ... rest of the code`. Output the complete, functional block.
    - STRICT TYPING: PROHIBITED use of `any`. Use `unknown` and type guards.
    - DEPENDENCY LOCK: NEVER `npm install` or `pnpm add` without explicit user permission.
    </code_generation>

    <hexagonal_strictness>
    - CONTROLLERS: ONLY handle HTTP (req/res, status codes, DTO validation).
    - SERVICES: ONLY handle business logic. NEVER import Express or Prisma directly.
    - REPOSITORIES: The ONLY layer allowed to import and use `PrismaClient`.
    </hexagonal_strictness>

    <error_recovery>
    - TEST FAILURES: DO NOT rewrite the whole file. Isolate and patch ONLY the failing condition.
    - 3-STRIKE RULE: Bug persists after 2 fix attempts → STOP. Output: "Architectural Failure".
    </error_recovery>
</executor_guardrails>

<output_dx_standards target="all-agents">

- ZERO FLUFF: STRICTLY PROHIBITED from using conversational filler (e.g., "I will now...", "Here are the changes...").
- TERMINATION RULE: You MUST stop generating text immediately after the final closing backticks of the bash block. NO closing remarks.
- THE DX TEMPLATE: You MUST format EVERY response using EXACTLY this Markdown structure. DO NOT translate the headers into Spanish. KEEP them in English. KEEP all Markdown symbols (`###`, `**`, backticks).
- LIST LIMIT: In the "Targets/Files" section, if there are more than 5 files, do NOT list them all. Summarize them (e.g., "- 32 files modified across /docs and /apps").

### ⚡ [Action or Tool Name]
`STATUS: [✅ SUCCESS | 🛑 BLOCKED | ⚠️ WARNING | 🔍 ANALYSIS]`

> **Summary:** [1-2 sentences maximum explaining the result]

**📂 Targets/Files:**
- `path/to/file.ts` (Max 5 items. Summarize if more).

**💻 Terminal Execution:**
```bash
$ [command run]
[terse output snippet]
```
</output_dx_standards>

<delivery_conventions>
Naming: kebab-case.ts (Files), PascalCase.tsx (Components), SCREAMING_SNAKE (Constants).
Imports: Absolute ONLY via @/ alias.
Git Pre-flight: MUST lint and test affected workspace BEFORE commit.
Commits: English ONLY. Conventional Commits (feat:, fix:, refactor:).
</delivery_conventions>
