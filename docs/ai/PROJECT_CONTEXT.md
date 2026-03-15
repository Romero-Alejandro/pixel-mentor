## 📋 PROJECT CONTEXT

**Objective:** Decouple backend from Gemini API to support any LLM provider at runtime, initially implementing Gemini and OpenRouter adapters while maintaining full extensibility

**Stack:** TypeScript, Express, Prisma, Zod, Ports & Adapters (Hexagonal), Dependency Injection

**Skills/MCPs:** Local filesystem only. Available skills: find-skills (installed). Active MCP servers: filesystem, engram.

**Hard Rules:**

- Domain ports (AIService, RAGService, QuestionClassifier, ComprehensionEvaluator) remain unchanged
- All provider-specific code isolated in `infrastructure/adapters/ai/`
- New providers added as new adapter files, no domain modifications
- Configuration-driven provider selection via `LLM_PROVIDER` env variable
- Initial providers: **Gemini** and **OpenRouter** only (no direct OpenAI/Anthropic)
- OpenRouter adapter must support any model available via OpenRouter API (e.g., OpenAI, Anthropic, Meta models) through config
- Zero breaking changes to existing API contracts
- Tests for factory and both provider adapters
- Follow SOLID, Single Responsibility, and Dependency Inversion principles

---

## 📋 FRONTEND-BACKEND ALIGNMENT PLAN

### Current State Analysis

**Backend API Endpoints (v1 - Recipe-based):**

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/recipe/start` - Start recipe session (body: `{ recipeId }`)
- `POST /api/recipe/interact` - Interact with recipe (body: `{ sessionId, studentInput }`)
- `GET /api/recipes` - List recipes (query: `?activeOnly=true|false`)
- `GET /api/recipes/:id` - Get single recipe
- `GET /api/sessions` - List sessions (query: `?studentId=xxx&activeOnly=true|false`)
- `GET /api/sessions/:id` - Get single session
- `POST /api/sessions/:id/replay` - Reset/replay session

**Frontend api.ts Endpoints (OUTDATED - Lesson-based):**

- `GET /api/lessons?activeOnly=...` → WRONG, should be `/api/recipes?activeOnly=...`
- `POST /api/leccion/start` → WRONG, should be `/api/recipe/start`
- `POST /api/leccion/interact` → WRONG, should be `/api/recipe/interact`
- Other auth/session endpoints: OK

**Type Mismatches:**

| Frontend Type                         | Backend DTO                                                                                                            | Issue                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `PedagogicalStateSchema` (5 states)   | `PedagogicalState` (7 states: ACTIVE_CLASS, RESOLVING_DOUBT, CLARIFYING, QUESTION, EVALUATION, COMPLETED, EXPLANATION) | Missing CLARIFYING, COMPLETED       |
| `Session.lessonId`                    | `Session.recipeId`                                                                                                     | Field renamed                       |
| `stateCheckpoint.currentSegmentIndex` | `stateCheckpoint.currentStepIndex`                                                                                     | Field renamed                       |
| N/A                                   | `Recipe` entity                                                                                                        | Missing in frontend                 |
| N/A                                   | `StartRecipeOutputSchema.feedback, isCorrect, extraExplanation`                                                        | Missing fields in frontend response |

---

### Alignment Blueprint

#### Step 1: Update api.ts Endpoints

1. Change `api.listLessons()` → call `GET /api/recipes?activeOnly=...`
2. Change `api.startLesson(lessonId)` → call `POST /api/recipe/start` with `{ recipeId: lessonId }`
3. Change `api.interactWithLesson(sessionId, studentInput)` → call `POST /api/recipe/interact`

#### Step 2: Add Missing Types to api.ts

1. Add `RecipeSchema` (from backend entity)
2. Update `PedagogicalStateSchema` to include `CLARIFYING`, `COMPLETED`
3. Add `feedback`, `isCorrect`, `extraExplanation` to `InteractLessonResponseSchema`
4. Add `currentStepIndex` to Session checkpoint types

#### Step 3: Create Shared Types Package (RECOMMENDED)

- Create `packages/shared/` with Zod schemas for:
  - `auth.ts` - User, AuthResponse
  - `recipe.ts` - Recipe, RecipeStep, StartRecipeInput/Output
  - `session.ts` - Session, SessionCheckpoint
  - `pedagogical.ts` - PedagogicalState enum
- Export from frontend via workspace import `@pixel-mentor/shared`

#### Step 4: Update Frontend Components

- `useLessonQueries.ts` - Update to use new endpoints and types
- `types/index.ts` - Align with backend entities or import from shared package
- Any component using `lessonId` - Consider renaming to `recipeId` for consistency

---

### Files to Modify

| File                                     | Change                                                     |
| ---------------------------------------- | ---------------------------------------------------------- |
| `apps/web/src/services/api.ts`           | Update endpoints, add Recipe type, update PedagogicalState |
| `apps/web/src/types/index.ts`            | Add Recipe type, align Session checkpoint                  |
| `apps/web/src/hooks/useLessonQueries.ts` | Update query keys and mutations                            |
| `packages/shared/` (NEW)                 | Create shared Zod schemas                                  |

### Validation Commands

- Frontend typecheck: `pnpm --filter @pixel-mentor/web typecheck`
- Backend health: `curl http://localhost:3001/health`

---

## 📊 AI_STATE

### Tareas Activas

- [ ] [apps/web/src/services/api.ts] - Actualizar endpoints de lecciones a recipes
- [ ] [apps/web/src/services/api.ts] - Agregar RecipeSchema y tipos faltantes
- [ ] [apps/web/src/services/api.ts] - Actualizar PedagogicalStateSchema con 7 estados
- [ ] [apps/web/src/types/index.ts] - Agregar tipo Recipe, alinear SessionCheckpoint
- [ ] [apps/web/src/hooks/useLessonQueries.ts] - Actualizar mutations para nuevos endpoints
- [ ] [packages/shared/] - Crear paquete de tipos compartidos (RECOMENDADO)
- [ ] [apps/api/src/domain/ports/ai-service.ts] - Verify interface provider-agnostic (no changes expected)
- [ ] [apps/api/src/infrastructure/adapters/ai/] - Create abstract base classes for shared prompt/error handling logic
- [ ] [apps/api/src/infrastructure/adapters/ai/openai-adapter.ts] - Implement AIService adapter for OpenAI
- [ ] [apps/api/src/infrastructure/adapters/ai/openai-rag-service.ts] - Implement RAGService adapter for OpenAI
- [ ] [apps/api/src/infrastructure/adapters/ai/openai-classifier.ts] - Implement QuestionClassifier adapter for OpenAI
- [ ] [apps/api/src/infrastructure/adapters/ai/openai-comprehension-evaluator.ts] - Implement ComprehensionEvaluator adapter for OpenAI
- [ ] [apps/api/src/infrastructure/adapters/ai/anthropic-adapter.ts] - Implement AIService adapter for Anthropic
- [ ] [apps/api/src/infrastructure/adapters/ai/anthropic-rag-service.ts] - Implement RAGService adapter for Anthropic
- [ ] [apps/api/src/infrastructure/adapters/ai/anthropic-classifier.ts] - Implement QuestionClassifier adapter for Anthropic
- [ ] [apps/api/src/infrastructure/adapters/ai/anthropic-comprehension-evaluator.ts] - Implement ComprehensionEvaluator adapter for Anthropic
- [ ] [apps/api/src/infrastructure/adapters/ai/factory.ts] - Create AIAdapterFactory that instantiates correct provider based on config
- [ ] [apps/api/src/infrastructure/adapters/ai/base-llm-adapter.ts] - Create abstract base class with common logging, error handling, prompt building
- [ ] [apps/api/src/index.ts] - Replace direct Gemini adapter instantiation with factory usage
- [ ] [apps/api/package.json] - Add openai and @anthropic-ai/sdk dependencies (optional peer deps)
- [ ] [apps/api/src/infrastructure/__tests__/adapters/ai/factory.test.ts] - Unit tests for AIAdapterFactory
- [ ] [apps/api/src/infrastructure/__tests__/adapters/ai/openai-adapter.test.ts] - Unit tests for OpenAI adapter
- [ ] [apps/api/.env.example] - Update with LLM_PROVIDER and provider-specific API key examples

### Tareas Futuras

- [High-level: Add unit tests for Anthropic adapters]
- [High-level: Implement provider fallback chain (e.g., try OpenAI then Anthropic on failure)]
- [High-level: Add metrics/telemetry for provider usage and latency]
- [High-level: Create provider-specific rate limiting strategies]
- [High-level: Document provider configuration in README]
