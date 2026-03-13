# Coding Standards

<ai_invariants>
[LANGUAGES]

- Source Code: STRICTLY English (Variables, functions, comments, logs).
- User-Facing: Visible UI strings and LLM prompts MUST be in Spanish.

[TYPESCRIPT_CONSTRAINTS]

- Mutability: Enforce `readonly` by default for data structures.
- State: Favor discriminated unions.
- Strictness: PROHIBITED: `any`. Use `unknown` and narrow the type.

[FILE_CONVENTIONS]

- Imports: Mandatory `@/` alias inside each package.
- Files: `kebab-case.ts`
- Components/Interfaces: `PascalCase`
- Hooks: `camelCase` (e.g., `useSession`)
- Constants: `SCREAMING_SNAKE_CASE`
  </ai_invariants>
