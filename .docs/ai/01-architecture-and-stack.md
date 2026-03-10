# Architecture & Tech Stack

## Stack

- **Frontend:** React (Vite, NO Next.js), Zustand, Tailwind CSS, Web Speech API, SpeechSynthesis API.
- **Backend:** Node.js (LTS), Express, PostgreSQL, Prisma.
- **AI/LLM:** Gemini Flash (via custom ApiKeyRotatorService).

## Backend Strict Hexagonal Rules (apps/api/src/)

1. `domain/`: ZERO external dependencies. Use opaque types for IDs. CANNOT import from Application or Infrastructure.
2. `application/`: Can ONLY import from `domain/`. Contains business use cases.
3. `infrastructure/`: Express adapters, Prisma repositories, Gemini API integrations.

## Database & Concurrency Constraints

- **Vectors:** Use `numeric[]` for embeddings (MVP). Plan for vector DB migration later.
- **Concurrency:** Resolve locks and consistency using PostgreSQL advisory locks for `session_id`.
- **Locking:** Use optimistic locking via `version` / `updated_at` columns for idempotent updates.
- **Security:** Argon2id for passwords. Request/Response validation via Zod.
