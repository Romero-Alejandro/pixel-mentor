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

## 📊 AI_STATE

### Tareas Activas

- [ ] [apps/api/src/config/index.ts] - Extend env schema with LLM*PROVIDER, OPENAI_API_KEY, ANTHROPIC_API_KEY, DEFAULT_MODEL*\* fields and validation
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
