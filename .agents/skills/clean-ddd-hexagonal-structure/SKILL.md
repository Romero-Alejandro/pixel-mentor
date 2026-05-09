---
name: clean-ddd-hexagonal-structure
description: Proactively apply when scaffolding or organizing files for APIs, microservices, or scalable backend structures. Enforces Feature-Sliced/Bounded-Context first directory structure, strict Layer boundaries (Domain, Application, Infrastructure), and file naming conventions. Optimized for Node.js and TypeScript ecosystems (Express, Zod, Prisma/TypeORM).
---

# SKILL: DDD & Hexagonal Directory Structure Enforcer

## 1. ARCHITECTURAL PARADIGM

Organize the project by **Bounded Context / Feature** first, NOT by technical layer. Each feature must contain its own isolated Domain, Application, and Infrastructure folders.

## 2. CORE RULES AND RESTRICTIONS

- **Dependency Rule:** Dependencies point **INWARD ONLY**. `Infrastructure` -> `Application` -> `Domain`.
- **Code Generation:** When generating code, **DO NOT include any explanatory comments**. The code must be self-descriptive through excellent naming conventions.
- **Single Responsibility:** One file = one responsibility.

## 3. STRICT DIRECTORY STRUCTURE

Generate and maintain the codebase strictly following this hierarchy:

```text
project/
├── src/
│   ├── main/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── container.ts
│   │   └── routes.ts
│   ├── shared/
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   └── index.ts
│   │   ├── errors/
│   │   │   ├── app-error.ts
│   │   │   ├── http-error.ts
│   │   │   └── index.ts
│   │   ├── http/
│   │   │   ├── error-handler.middleware.ts
│   │   │   ├── not-found.middleware.ts
│   │   │   └── index.ts
│   │   ├── logger/
│   │   │   ├── logger.ts
│   │   │   └── index.ts
│   │   ├── utils/
│   │   └── types/
│   │       ├── common.types.ts
│   │       └── index.ts
│   ├── features/
│   │   └── [feature-name]/
│   │       ├── domain/
│   │       │   ├── [name].entity.ts
│   │       │   ├── [name].repository.port.ts
│   │       │   └── [name].errors.ts
│   │       ├── application/
│   │       │   ├── dtos/
│   │       │   │   ├── create-[name].dto.ts
│   │       │   │   └── update-[name].dto.ts
│   │       │   ├── use-cases/
│   │       │   │   ├── create-[name].use-case.ts
│   │       │   │   └── get-[name].use-case.ts
│   │       │   └── ports/
│   │       ├── infrastructure/
│   │       │   ├── persistence/
│   │       │   │   ├── [name].model.ts
│   │       │   │   ├── [name].repository.ts
│   │       │   │   └── [name].mapper.ts
│   │       │   ├── http/
│   │       │   │   ├── [name].controller.ts
│   │       │   │   ├── [name].routes.ts
│   │       │   │   └── [name].schemas.ts
│   │       │   └── index.ts
│   │       └── index.ts
│   └── database/
│       ├── [orm-name]/ # e.g., prisma/, typeorm/, mongoose/
│       ├── migrations/
│       └── index.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env
├── package.json
└── tsconfig.json
```

## 4. FILE PLACEMENT DECISION TREE

Use this matrix to determine the exact folder for any new file:

```text
Where does this file go?
├─ Is it pure business logic, defining identity or rules? → features/[name]/domain/
├─ Does it define HOW data is saved (Interface)?          → features/[name]/domain/
├─ Does it execute a user action (orchestration)?         → features/[name]/application/use-cases/
├─ Is it the data payload coming into a use case?         → features/[name]/application/dtos/
├─ Does it talk to a database (SQL, ORM)?                 → features/[name]/infrastructure/persistence/
├─ Does it handle HTTP requests (REST, GraphQL)?          → features/[name]/infrastructure/http/
└─ Is it a utility used by multiple independent features? → shared/
```

## 5. STRATEGIC TYPESCRIPT TYPE MANAGEMENT

- **Type Isolation (Leak Prevention):** It is strictly forbidden for types generated or inferred by infrastructure tools (like dynamic Prisma, TypeORM, or Zod types) to leak into the `application` or `domain` layers.
- **Mandatory Mapping:** Use the `infrastructure/persistence/*mapper.ts` layer to transform database types (ORM models) into pure TypeScript entities (`domain/*.entity.ts`) before sending them to use cases.
- **Contracts:** Use `interface` to define ports (repository or external service contracts) in `domain` or `application`.
- **Domain Types:** Native business types (enums, aliases, entity configurations) must reside alongside their entity in `domain`.
- **Global Types:** Cross-cutting types independent of a feature must reside in `shared/types/*.types.ts`.

## 6. VALIDATION MANAGEMENT (E.g., Zod, Joi, Yup)

- **Location:** Exclusively in `infrastructure/http/*.schemas.ts` (or the corresponding library suffix).
- **Allowed Use:** Validate the HTTP application boundary (`body`, `params`, `query`, and `headers`).
- **Forbidden:** DO NOT use the validation library in `domain` or `application` layers.

## 7. PERSISTENCE MANAGEMENT (E.g., Prisma, TypeORM, Mongoose)

- **Location:** Global configurations in `database/`. Specific models and repositories in `infrastructure/persistence/`.
- **Isolation:** The domain does not know how data is saved. All data access must be done through a Repository class (`[name].repository.ts`) that implements the interface (`[name].repository.port.ts`) defined in the domain.
- **Forbidden:** DO NOT use ORM decorators, base classes (like Sequelize/Mongoose `Model`), or ORM-generated types inside the `domain` folder.

## 8. NAMING STANDARDS

- **Folders:** `kebab-case`.
- **Files:** `kebab-case.[role].ts` (e.g., `user.controller.ts`, `user.repository.ts`).
- **Classes and Types/Interfaces:** `PascalCase`.
- **Functions and Methods:** `camelCase`.
- **Constants:** `UPPER_SNAKE_CASE`.
- **Index (`index.ts`):** Use exclusively as facades (Barrels) for exports. Do not write functional logic in them.

## 9. FINAL RULE (DOMAIN IMMUTABILITY)

The domain is the absolute truth of the business and must not require any modifications if, in the future, the HTTP framework (e.g., Express to Fastify), the ORM (e.g., Prisma to Drizzle/TypeORM), or the validation library (e.g., Zod to Joi) is changed.
