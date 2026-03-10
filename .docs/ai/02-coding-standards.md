# Coding Standards

## Languages

- **Source Code:** Strictly English (Variables, functions, comments, logs).
- **User-Facing:** Visible UI strings and LLM prompts MUST be in Spanish.

## TypeScript Constraints

- Enforce `readonly` by default for data structures.
- Favor discriminated unions for state management.
- PROHIBITED: `any`. Use `unknown` and narrow the type.

## File & Import Rules

- PROHIBITED: Barrel files (`index.ts` that just re-export).
- **Imports:** Mandatory `@/` alias inside each package.

## Naming Conventions

- **Files:** `kebab-case.ts`
- **Components/Interfaces:** `PascalCase`
- **Hooks:** `camelCase` (e.g., `useSession`)
- **Constants:** `SCREAMING_SNAKE_CASE`
