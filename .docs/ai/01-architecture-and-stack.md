# Architecture & Tech Stack

<ai_invariants>
[STACK]

- Frontend: React (Vite), Zustand, Tailwind, Web Speech API. NO Next.js.
- Backend: Node.js (LTS), Express, PostgreSQL, Prisma.
- AI/LLM: Gemini Flash (routed via ApiKeyRotatorService).

[HEXAGONAL_RULES]

- `domain/`: ZERO external dependencies. Use opaque types for IDs. CANNOT import from Application or Infrastructure.
- `application/`: Can ONLY import from `domain/`. Contains business use cases.
- `infrastructure/`: Express adapters, Prisma repositories, Gemini API integrations.

[DATABASE_CONSTRAINTS]

- Vectors: Use `numeric[]` for embeddings.
- Concurrency: MUST use PostgreSQL advisory locks mapped to `session_id`.
- Locking: Implement Optimistic Locking via `version` / `updated_at` columns.
- Security: Hash passwords via Argon2id. Validate requests/responses strictly via Zod.
  </ai_invariants>
