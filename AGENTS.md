# Project: Pixel Mentor

Domain: EdTech platform (Interactive voice tutoring for kids 6-12).
Architecture: Monorepo, Strict Hexagonal Architecture.

<routing_manifest>
CRITICAL: Map your current task to the exact domain below and use `mcp:filesystem` to read ONLY the corresponding file(s) BEFORE starting Phase 1. Do NOT bulk read.

[DOMAIN: Architecture, Stack & Database]

- Triggers: Modifying backend layers, DB schema, Prisma queries, Express, Hexagonal rules.
- Target Files:
  - Rules: `.docs/ai/01-architecture-and-stack.md`
  - Current Schema: `apps/api/prisma/schema.prisma`

[DOMAIN: Coding Standards & UI Conventions]

- Triggers: Creating new files, React/Zustand, Tailwind, TypeScript strict rules, naming.
- Target File: `.docs/ai/02-coding-standards.md`

[DOMAIN: Product Logic & Core RAG Flows]

- Triggers: Voice tutor flow, Gemini LLM prompts, RAG retrieval pipeline, question detection.
- Target File: `.docs/ai/03-core-flows.md`

[DOMAIN: State Machine & Concurrency]

- Triggers: Session state transitions, advisory locks, optimistic locking, timeouts.
- Target File: `.docs/ai/04-state-machine.md`

[DOMAIN: Security, NFRs & Escalation]

- Triggers: ApiKeyRotator, circuit breakers, data retention, Zero-Audio privacy, human teacher review.
- Target File: `.docs/ai/05-security-nfr.md`
  </routing_manifest>

<skill_mapping_hints>

- Database/Prisma -> "Supabase-postgres-best-practices"
- Endpoints/Auth -> "Security Best Practices" & "API Design Principles"
- Frontend/Components -> "Interface Design"
- Bug fixing -> "Systematic Debugging"
  </skill_mapping_hints>
