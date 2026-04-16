## Exploration: step-type-unification

### Current State

The application uses a `Recipe` entity that contains a list of `RecipeStep`s. Each `RecipeStep` has an optional `stepType` property (`'content' | 'activity' | 'question' | 'intro' | 'closure'`) and a generic `script?: StepScript` where `StepScript` is defined as `Record<string, unknown>`.

In the backend (`apps/api/src/features/recipe/application/use-cases/orchestrate-recipe.use-case.ts`), specific interfaces (`ContentScript`, `QuestionScript`, `ActivityScript`) are defined internally to represent the expected payload structure for the `script` field based on its `stepType`. The code heavily relies on runtime type checks (`isQuestionScript`, `isActivityScript`) and explicit casting (`script as QuestionScript`) to access the properties of the `script` object. There's also a `PrismaStepType` enum that is aliased, but the comparison often falls back to string literals.

In the frontend (`apps/web/src/features/recipe-management/components/StepEditor.tsx`), the `StepEditor` component conditionally renders input fields based on the selected `stepType`. When loading a `RecipeStep` for editing, it inspects an implicit `kind` property within the `script` object to determine its specific type. When saving, it adds this `kind` property to the `script` payload before sending it to the backend. This `kind` property is not explicitly defined in the backend types but is used for differentiation.

### Affected Areas

- `apps/api/src/features/recipe/domain/entities/recipe.entity.ts` — Definition of `RecipeStep`, `StepType`, and related script interfaces.
- `apps/api/src/features/recipe/application/use-cases/orchestrate-recipe.use-case.ts` — Contains extensive logic for processing different `stepType`s, including type guards, conditional logic, and explicit casting of the `script` property.
- `apps/web/src/features/recipe-management/components/StepEditor.tsx` — Component for creating/editing recipe steps, which uses conditional rendering and implicitly relies on a `kind` property within the `script` field for differentiating step types.
- `packages/shared/` — The shared type definitions for `RecipeStep` and its associated types should ideally reside here.

### Approaches

1.  **Refactor `RecipeStep` using Discriminated Unions (Recommended)**
    - **Description**: Leverage TypeScript's discriminated unions to create a type-safe `RecipeStep` where the `script` property's structure is explicitly tied to the `stepType` property. This involves defining specific interfaces for each `StepType`'s script payload and then combining them into a union type.
    - **Pros**:
      - **Enhanced Type Safety**: TypeScript compiler will enforce that the `script` object matches the expected structure for its `stepType`, eliminating runtime errors related to incorrect property access.
      - **Reduced Boilerplate**: Removes the need for explicit type guards (`isQuestionScript`, `isActivityScript`) and repeated conditional casting in the backend.
      - **Improved Readability and Maintainability**: Code becomes clearer as the expected data structure for each step type is immediately apparent. Adding new step types or modifying existing ones will be more localized and type-checked.
      - **Aligns Frontend and Backend**: Eliminates the need for the implicit `kind` property in the frontend's `script` payload, as the `stepType` itself will be the discriminant across both layers.
    - **Cons**:
      - Requires changes in both backend and frontend code that interact with `RecipeStep`.
      - Initial refactoring effort.
    - **Effort**: Medium

2.  **Keep Current Approach with Refinements**
    - **Description**: Maintain the current structure but formalize the `kind` property in `StepScript` and ensure clearer documentation/comments.
    - **Pros**:
      - Minimal code changes.
    - **Cons**:
      - Does not address the core type safety issue.
      - Continues to rely on runtime checks and implicit conventions.
      - Higher risk of runtime errors when modifying or extending step types.
      - Maintenance remains cumbersome.
    - **Effort**: Low

### Recommendation

I recommend **Approach 1: Refactor `RecipeStep` using Discriminated Unions**. This approach provides significant benefits in terms of type safety, maintainability, and code clarity, outweighing the initial refactoring effort. It will create a more robust and scalable solution for managing different step types in the application.

### Risks

- **Refactoring Complexity**: Changes to `RecipeStep` will propagate to many parts of the codebase, requiring careful coordination and testing to ensure no regressions are introduced.
- **Migration of existing data**: If the backend database schema for `RecipeStep.script` is strongly typed, a migration might be needed. However, given `Record<string, unknown>`, it's likely stored as JSON, so schema changes might be minimal, but data validation logic will change.
- **Frontend-Backend Desync**: If the frontend and backend type definitions and logic are not updated in sync, it could lead to integration issues.

### Ready for Proposal

Yes
