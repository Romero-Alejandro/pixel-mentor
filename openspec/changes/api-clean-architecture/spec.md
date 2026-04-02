# Technical Specification: API Clean Architecture

**Change**: `api-clean-architecture`
**Project**: `pixel-mentor`

## 1. Introduction

This document provides the detailed technical specifications for restructuring the Pixel Mentor API from its current state into a feature-sliced application following Clean Architecture, Domain-Driven Design (DDD), and Hexagonal Architecture principles.

The goal is to improve modularity, maintainability, and scalability by organizing code into bounded contexts (features), separating concerns into distinct layers (domain, application, infrastructure), and depending on abstractions rather than concrete implementations.

---

## FR-001: Feature Directory Structure

### Description

A standardized directory structure will be created for each feature. This ensures consistency and predictability across the codebase.

### Migration Rules

For each identified bounded context, the following directory structure MUST be created under `apps/api/src/features/`:

```
<feature-name>/
├── domain/
│   ├── entities/
│   ├── ports/
│   ├── services/
│   └── errors/
├── application/
│   ├── use-cases/
│   ├── services/
│   └── dto/
├── infrastructure/
│   ├── persistence/
│   ├── http/
│   └── container.ts
└── index.ts
```

- **`features/`**: The root directory for all bounded contexts.
  - `auth`, `recipe`, `session`, `activity`, `progress`, `gamification`, `class`, `evaluation`, `tts`, `knowledge`, `prompt`.

### Acceptance Criteria

- [ ] All specified feature directories (`auth` through `prompt`) are created under `apps/api/src/features/`.
- [ ] Each feature directory contains the `domain`, `application`, `infrastructure` subdirectories and a root `index.ts`.
- [ ] The `index.ts` file in each feature directory serves as the public API for the module, exporting the feature's container and router.

### Edge Cases

- **Lean Features**: Some features (e.g., `tts`) might not have extensive domain logic or application use cases. The full directory structure MUST still be created for consistency, even if some folders remain empty initially. This supports future growth without structural changes.

---

## FR-002: Entity Migration

### Description

All domain entities, currently located in a flat structure at `apps/api/src/domain/entities/`, will be moved to the `domain/entities/` subdirectory of their respective feature. This co-locates entities with the business logic that governs them.

### Migration Rules

The following mapping MUST be applied to move entity files:

| Entity File (`domain/entities/*`) | Target Feature (`features/{name}/domain/entities/`) |
| :-------------------------------- | :-------------------------------------------------- |
| `user.ts`                         | `auth`                                              |
| `api-key.ts`                      | `auth`                                              |
| `parental-consent.ts`             | `auth`                                              |
| `recipe.ts`                       | `recipe`                                            |
| `recipe-tag.ts`                   | `recipe`                                            |
| `tag.ts`                          | `recipe`                                            |
| `recipe-config.ts`                | `recipe`                                            |
| `session.ts`                      | `session`                                           |
| `interaction.ts`                  | `session`                                           |
| `micro-interaction.ts`            | `session`                                           |
| `activity.ts`                     | `activity`                                          |
| `activity-attempt.ts`             | `activity`                                          |
| `student-progress.ts`             | `progress`                                          |
| `user-progress.ts`                | `progress`                                          |
| `competency.ts`                   | `progress`                                          |
| `competency-mastery.ts`           | `progress`                                          |
| `atom-competency.ts`              | `progress` (related to Competency)                  |
| `badge.ts` (from `game-engine`)   | `gamification`                                      |
| `level.ts`                        | `gamification`                                      |
| `class.entity.ts`                 | `class`                                             |
| `module.ts`                       | `class` (as ClassModule or similar)                 |
| `atom.ts`                         | `class` (as LessonAtom or similar)                  |
| `pedagogical-state.ts`            | `evaluation`                                        |
| `question-classification.ts`      | `evaluation`                                        |
| `teacher-review-ticket.ts`        | `evaluation`                                        |
| `knowledge-chunk.ts`              | `knowledge`                                         |
| `concept.ts`                      | `knowledge`                                         |
| `asset.ts`                        | `shared/domain/entities` (or a new `asset` feature) |
| `asset-attachment.ts`             | `shared/domain/entities` (or a new `asset` feature) |
| `event-log.ts`                    | `shared/domain/entities`                            |

### Acceptance Criteria

- [ ] All entity files listed are moved to their new locations.
- [ ] The original `apps/api/src/domain/entities/` directory is deleted.
- [ ] There are no direct `import` statements for an entity from another feature's `domain` folder (e.g., `features/recipe/domain/entities/recipe.ts` cannot import from `features/auth/domain/entities/user.ts`).
- [ ] Cross-feature entity access MUST be done via repository ports or dedicated application services that return DTOs.

### Edge Cases

- **Cross-Context Relationships**: Relationships between entities now in different bounded contexts (e.g., a Recipe's creator User) MUST be handled by storing only an ID (e.g., `creatorId: string`). The full related entity must be fetched via a call to the other feature's application service or repository port.

---

## FR-003: Port Migration

### Description

Domain ports (interfaces), currently in `apps/api/src/domain/ports/`, will be moved to the `domain/ports/` subdirectory of their owning feature or to a shared location if they represent cross-cutting concerns.

### Migration Rules

The following mapping MUST be applied to move port files:

| Port File (`domain/ports/*`)          | Target Location                       | Notes                              |
| :------------------------------------ | :------------------------------------ | :--------------------------------- |
| `user-repository.ts`                  | `features/auth/domain/ports/`         |                                    |
| `api-key-repository.ts`               | `features/auth/domain/ports/`         |                                    |
| `parental-consent-repository.ts`      | `features/auth/domain/ports/`         |                                    |
| `recipe-repository.ts`                | `features/recipe/domain/ports/`       |                                    |
| `recipe-tag-repository.ts`            | `features/recipe/domain/ports/`       |                                    |
| `tag-repository.ts`                   | `features/recipe/domain/ports/`       |                                    |
| `session-repository.ts`               | `features/session/domain/ports/`      |                                    |
| `interaction-repository.ts`           | `features/session/domain/ports/`      |                                    |
| `activity-repository.ts`              | `features/activity/domain/ports/`     |                                    |
| `activity-attempt-repository.ts`      | `features/activity/domain/ports/`     |                                    |
| `progress-repository.ts`              | `features/progress/domain/ports/`     | For `UserProgress`                 |
| `competency-repository.ts`            | `features/progress/domain/ports/`     |                                    |
| `competency-mastery-repository.ts`    | `features/progress/domain/ports/`     |                                    |
| `level-repository.ts`                 | `features/gamification/domain/ports/` |                                    |
| `gamification-ports.ts`               | `features/gamification/domain/ports/` | Contains multiple related ports    |
| `module-repository.ts`                | `features/class/domain/ports/`        |                                    |
| `atom-repository.ts`                  | `features/class/domain/ports/`        |                                    |
| `teacher-review-ticket-repository.ts` | `features/evaluation/domain/ports/`   |                                    |
| `question-classifier.ts`              | `features/evaluation/domain/ports/`   | AI service port                    |
| `tts-service.ts`                      | `features/tts/domain/ports/`          |                                    |
| `knowledge-chunk-repository.ts`       | `features/knowledge/domain/ports/`    |                                    |
| `concept-repository.ts`               | `features/knowledge/domain/ports/`    |                                    |
| `rag-service.ts`                      | `features/knowledge/domain/ports/`    | AI service port                    |
| `prompt-repository.ts`                | `features/prompt/domain/ports/`       |                                    |
| `prompt-injector.ts`                  | `features/prompt/domain/ports/`       |                                    |
| `ai-service.ts`                       | `shared/domain/ports/`                | Generic AI port, used by many      |
| `advisory-lock.ts`                    | `shared/domain/ports/`                | Cross-cutting infra concern        |
| `event-log-repository.ts`             | `shared/domain/ports/`                | Cross-cutting monitoring concern   |
| `asset-repository.ts`                 | `shared/domain/ports/`                | If `asset` becomes a shared kernel |
| `asset-attachment-repository.ts`      | `shared/domain/ports/`                | If `asset` becomes a shared kernel |
| `auth-errors.ts`                      | `features/auth/domain/errors/`        | This is an error definition file   |

### Acceptance Criteria

- [ ] All port files are moved according to the mapping table.
- [ ] The original `apps/api/src/domain/ports/` directory is deleted.
- [ ] Application and Infrastructure layers only import ports from their own feature or from `shared/`.

### Edge Cases

- **Generic Ports**: Ports like `ai-service.ts` are used across multiple features. They correctly belong in `shared/domain/ports` to avoid artificial dependencies.

---

## FR-004: Repository Consolidation

### Description

All data persistence implementations (repositories) will be consolidated and moved into the `infrastructure/persistence/` subdirectory of their corresponding feature. This removes duplication and co-locates implementations with their feature.

### Migration Rules

- All repository files from `apps/api/src/infrastructure/adapters/database/repositories/` MUST be moved.
- All repository files from `apps/api/src/infrastructure/repositories/` MUST be moved.
- The file `apps/api/src/domain/repositories/class.repository.ts` is an anomaly and MUST be moved.
- The target directory for all repository implementations is `apps/api/src/features/{feature}/infrastructure/persistence/`.

**Mapping:**

| Repository Implementation                | Target Feature (`features/{name}/infrastructure/persistence/`) |
| :--------------------------------------- | :------------------------------------------------------------- |
| `user-repository.ts`                     | `auth`                                                         |
| `api-key-repository.ts`                  | `auth`                                                         |
| `parental-consent-repository.ts`         | `auth`                                                         |
| `recipe-repository.ts`                   | `recipe`                                                       |
| `recipe-tag-repository.ts`               | `recipe`                                                       |
| `tag-repository.ts`                      | `recipe`                                                       |
| `session-repository.ts`                  | `session`                                                      |
| `interaction-repository.ts`              | `session`                                                      |
| `activity-repository.ts`                 | `activity`                                                     |
| `activity-attempt-repository.ts`         | `activity`                                                     |
| `progress-repository.ts`                 | `progress`                                                     |
| `competency-repository.ts`               | `progress`                                                     |
| `competency-mastery-repository.ts`       | `progress`                                                     |
| `prisma-user-gamification.repository.ts` | `gamification`                                                 |
| `prisma-badge.repository.ts`             | `gamification`                                                 |
| `level-repository.ts`                    | `gamification`                                                 |
| `prisma-class.repository.ts`             | `class`                                                        |
| `prisma-class-lesson.repository.ts`      | `class`                                                        |
| `prisma-class-version.repository.ts`     | `class`                                                        |
| `prisma-class-template.repository.ts`    | `class`                                                        |
| `module-repository.ts`                   | `class`                                                        |
| `atom-repository.ts`                     | `class`                                                        |
| `teacher-review-ticket-repository.ts`    | `evaluation`                                                   |
| `knowledge-chunk-repository.ts`          | `knowledge`                                                    |
| `concept-repository.ts`                  | `knowledge`                                                    |
| `advisory-lock.ts`                       | `shared/infrastructure/persistence/`                           |
| `event-log-repository.ts`                | `shared/infrastructure/persistence/`                           |
| `asset-repository.ts`                    | `shared/infrastructure/persistence/`                           |
| `asset-attachment-repository.ts`         | `shared/infrastructure/persistence/`                           |
| `prisma-base.repository.ts`              | `shared/infrastructure/persistence/`                           |

### Acceptance Criteria

- [ ] The directories `infrastructure/adapters/database/repositories/`, `infrastructure/repositories/`, and `domain/repositories/` are deleted.
- [ ] All repository implementation files are moved to their new feature-specific locations.
- [ ] DI containers are updated to register and resolve repositories from their new paths.

### Edge Cases

- **Base Repositories**: `prisma-base.repository.ts` provides shared logic. It correctly belongs in `shared/infrastructure/persistence/` and can be extended by feature-specific repositories.

---

## FR-005: Use Case Migration

### Description

Application use cases (interactors), currently located in `apps/api/src/application/use-cases/`, will be moved to the `application/use-cases/` subdirectory of their owning feature.

### Migration Rules

The use case groups will be moved as follows:

| Use Case Group (`application/use-cases/*`) | Target Feature (`features/{name}/application/use-cases/`) |
| :----------------------------------------- | :-------------------------------------------------------- |
| `auth/`                                    | `auth`                                                    |
| `recipe/`                                  | `recipe`                                                  |
| `session/`                                 | `session`                                                 |
| `activity/`                                | `activity`                                                |
| `progress/`                                | `progress`                                                |
| `question/`                                | `evaluation` (as part of an evaluation use case)          |
| `event/`                                   | `shared/application/use-cases` (if generic)               |

### Acceptance Criteria

- [ ] All use case files are moved to their new feature-specific directories.
- [ ] The original `apps/api/src/application/use-cases/` directory is deleted.
- [ ] Import paths for entities, ports, and DTOs within use cases are updated.

---

## FR-006: Application Services Migration

### Description

Application services from `apps/api/src/application/services/` will be moved to the `application/services/` subdirectory of their owning feature.

### Migration Rules

| Application Service (`application/services/*`) | Target Feature (`features/{name}/application/services/`) |
| :--------------------------------------------- | :------------------------------------------------------- |
| `recipe.service.ts`                            | `recipe`                                                 |
| `recipe-ai.service.ts`                         | `recipe`                                                 |
| `class.service.ts`                             | `class`                                                  |
| `class-ai.service.ts`                          | `class`                                                  |
| `class-template.service.ts`                    | `class`                                                  |
| `admin-user.service.ts`                        | `auth` (or a dedicated `admin` feature)                  |
| `context-window.service.ts`                    | `shared/application/services` (cross-cutting concern)    |

### Acceptance Criteria

- [ ] All application service files are moved.
- [ ] The original `apps/api/src/application/services/` directory is deleted.
- [ ] DI containers are updated with the new locations.

---

## FR-007: Route/HTTP Migration

### Description

All HTTP-related components (routes, controllers, feature-specific middleware) will be moved from `apps/api/src/infrastructure/adapters/http/` to the `infrastructure/http/` subdirectory of the relevant feature.

### Migration Rules

- **Routes**: `routes/{name}.routes.ts` -> `features/{name}/infrastructure/http/index.ts` (or `routes.ts`). Each feature should export an Express Router.
- **Controllers**: `controllers/{name}.controller.ts` -> `features/{name}/infrastructure/http/controller.ts`.
- **Middleware**: Feature-specific middleware (e.g., a validator for a recipe payload) moves with the feature. Shared middleware (e.g., `isAuthenticated`) moves to `shared/http/middleware/`.
- **Central Router**: `apps/api/src/main/routes.ts` will be created to import all feature routers and mount them on the main Express app.

### Acceptance Criteria

- [ ] The `infrastructure/adapters/http/` directory is deleted.
- [ ] Each feature with HTTP endpoints has an `infrastructure/http/` directory containing its router, controller(s), and any specific middleware or schemas.
- [ ] The main application router in `main/routes.ts` correctly assembles all feature routes.
- [ ] All API endpoints function as before.

---

## FR-008: Root-Level Module Migration

### Description

Large, misplaced modules at the root of `apps/api/src/` will be relocated to their correct place within the new architecture.

### Migration Rules

| Source Directory (`apps/api/src/*`) | Target Directory                            |
| :---------------------------------- | :------------------------------------------ |
| `game-engine/`                      | `features/gamification/`                    |
| `evaluator/`                        | `features/evaluation/`                      |
| `llm/`                              | `infrastructure/llm/` (Top-level infra)     |
| `prompt/`                           | `features/prompt/`                          |
| `events/`                           | `infrastructure/events/` (Top-level infra)  |
| `prompts/` (template files)         | `features/prompt/infrastructure/templates/` |

### Acceptance Criteria

- [ ] The specified root-level directories are moved to their new locations.
- [ ] All internal import paths within the moved modules are updated.
- [ ] The DI container is updated to resolve dependencies from the new locations.

---

## FR-009: Shared Module Extraction

### Description

Cross-cutting concerns and shared code will be extracted into the top-level `apps/api/src/shared/` directory.

### Migration Rules

| Source Directory (`apps/api/src/*`) | Target Directory (`apps/api/src/shared/*`) |
| :---------------------------------- | :----------------------------------------- |
| `config/`                           | `config/`                                  |
| `types/`                            | `types/`                                   |
| `utils/`                            | `utils/`                                   |
| `validation/`                       | `validation/`                              |
| `domain/errors/`                    | `errors/`                                  |
| `monitoring/`                       | `monitoring/`                              |
| `infrastructure/http/` (orphaned)   | `http/`                                    |
| `infrastructure/cache/`             | `cache/`                                   |
| `infrastructure/observability/`     | `observability/`                           |
| `infrastructure/resilience/`        | `resilience/`                              |
| `infrastructure/transactions/`      | `transactions/`                            |

### Acceptance Criteria

- [ ] A `shared/` directory exists at `apps/api/src/shared/`.
- [ ] All specified directories and their contents are moved into `shared/`.
- [ ] The original directories are deleted.
- [ ] Import paths across the application are updated to reference `@/shared/...`.

---

## FR-010: DI Container Refactoring

### Description

The monolithic `dependency-container.ts` will be dismantled and replaced with a federated system of dependency injection containers, one for each feature, composed at the application's entry point.

### Migration Rules

1.  **Create Feature Containers**: For each feature, create `features/{name}/infrastructure/container.ts`. This file will be responsible for registering all dependencies for that feature (use cases, repositories, services).
2.  **Populate Feature Containers**: Migrate the relevant registrations from `dependency-container.ts` into each feature's container file.
3.  **Create Main Container**: Create `main/container.ts`. This container will import the container from each feature and compose them. It will manage the lifecycle of the entire application's dependency graph.
4.  **Bootstrap**: The main server bootstrap file (`main/server.ts`) will use the main container to resolve the top-level application object.

### Acceptance Criteria

- [ ] The `apps/api/src/dependency-container.ts` file is deleted.
- [ ] Each feature has its own `container.ts` in its infrastructure layer.
- [ ] `apps/api/src/main/container.ts` exists and composes all feature containers.
- [ ] The application successfully starts and all dependencies are resolved correctly.

### Edge Cases

- **Inter-Feature Dependencies**: If `featureA` needs a service from `featureB`, `featureA`'s container will take `featureB`'s container as an input. The main container will be responsible for wiring them correctly. Dependencies should always be on ports (abstractions), not concrete implementations from other features.

---

## FR-011: Import Path Migration

### Description

All relative import paths (`../../../`) will be replaced with TypeScript path aliases to improve code readability and reduce fragility during refactoring.

### Migration Rules

1.  **Configure `tsconfig.json`**: Add the following `paths` to the `compilerOptions`:
    ```json
    "paths": {
      "@/features/*": ["./src/features/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/main/*": ["./src/main/*"],
      "@/infrastructure/*": ["./src/infrastructure/*"]
    }
    ```
2.  **Update Imports**: Systematically replace relative imports throughout the codebase with their aliased equivalents.
    - `import { User } from '../../auth/domain/entities/user';` -> `import { User } from '@/features/auth/domain/entities/user';`
    - `import { AppError } from '../../../domain/errors/app-error';` -> `import { AppError } from '@/shared/errors/app-error';`

### Acceptance Criteria

- [ ] `tsconfig.json` is updated with the specified path aliases.
- [ ] The codebase contains no relative imports that traverse more than two directory levels (`../..`).
- [ ] The project compiles successfully with the new paths (`pnpm --filter @pixel-mentor/api typecheck`).

---

## FR-012: Non-Functional Requirements

### Description

This refactoring MUST NOT introduce regressions. The external behavior of the API must remain unchanged, and the project must remain in a healthy, maintainable state.

### Acceptance Criteria

- [ ] **Tests Pass**: All existing unit, integration, and e2e tests MUST pass after the refactoring is complete. Test files will need to be moved and their imports updated to match the new structure.
- [ ] **No Compilation Errors**: The project MUST compile without any TypeScript errors. (`pnpm --filter @pixel-mentor/api typecheck`).
- [ ] **No Linting Errors**: The code MUST adhere to all existing linting rules (`pnpm lint`).
- [ ] **No Circular Dependencies**: The new structure MUST NOT introduce any circular dependencies between modules. This can be checked with tools like `madge`.
- [ ] **Build Unchanged**: The final build output (`dist/`) should be structurally and functionally equivalent to the output before the change.

### Edge Cases

- **Test Refactoring**: Tests that rely on implementation details or brittle paths will break. These tests MUST be refactored to align with the new architecture, focusing on testing the public API of modules (use cases and controllers).
