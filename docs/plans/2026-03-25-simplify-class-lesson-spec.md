# Delta Spec: Simplify ClassLesson Entity

**Date**: 2026-03-25
**Author**: AI Agent
**Status**: DRAFT

## 1. Overview

This document specifies the changes required to simplify the `ClassLesson` entity. The goal is to make `ClassLesson` a simple organizational bridge between a `Class` and a `Recipe`. Redundant fields (`title`, `duration`) will be removed, and the association with a `Recipe` will become mandatory.

---

## 2. Database Requirements (`database`)

### MODIFIED: `ClassLesson` Model

The `ClassLesson` model in `apps/api/prisma/schema.prisma` will be modified to enforce its role as a direct link to a `Recipe`.

**File**: `apps/api/prisma/schema.prisma`

**Current `ClassLesson` Model:**

```prisma
model ClassLesson {
  id          String   @id @default(cuid())
  classId     String
  class       Class    @relation(fields: [classId], references: [id], onDelete: Cascade)

  recipeId    String?
  recipe      Recipe?  @relation(fields: [recipeId], references: [id], onDelete: SetNull)

  order       Int      @db.SmallInt
  title       String   @db.VarChar(255)
  duration    Int?     @db.SmallInt // minutes

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([classId, order])
  @@map("class_lessons")
}
```

**New `ClassLesson` Model:**

```prisma
model ClassLesson {
  id          String   @id @default(cuid())
  classId     String
  class       Class    @relation(fields: [classId], references: [id], onDelete: Cascade)

  // recipeId is now mandatory and the relation is non-optional
  recipeId    String
  recipe      Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  order       Int      @db.SmallInt

  // REMOVED: title       String   @db.VarChar(255)
  // REMOVED: duration    Int?     @db.SmallInt // minutes

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([classId, order])
  @@map("class_lessons")
}
```

### REQUIREMENT: Data Migration

A database migration script **MUST** be created to handle existing data.

- **Requirement**: Any `ClassLesson` record where `recipeId` is `NULL` **MUST** be deleted. These records become invalid under the new schema and represent incomplete data that cannot be salvaged automatically.
- **Action**: The migration script should execute `DELETE FROM "class_lessons" WHERE "recipeId" IS NULL;` before applying the schema changes.

---

## 3. Backend Requirements (`backend`)

### MODIFIED: Data Transfer Objects (DTOs)

The DTOs for creating and updating lessons **MUST** be changed to reflect the new data model.

**File**: `apps/api/src/infrastructure/adapters/http/routes/classes.ts` (or equivalent DTO file)

**Current Schemas:**

```typescript
const AddLessonSchema = z.object({
  title: z.string().min(1).max(255),
  recipeId: z.string().optional(),
  duration: z.number().min(1).max(180).optional(),
});

const UpdateLessonSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  recipeId: z.string().optional().nullable(),
  duration: z.number().min(1).max(180).optional().nullable(),
});
```

**New Schemas:**

```typescript
// Renamed to reflect its purpose
const AddLessonToClassSchema = z.object({
  // ADDED: recipeId is now required
  recipeId: z.string(),
  // REMOVED: title, duration
});

const UpdateClassLessonSchema = z.object({
  // ADDED: recipeId is now the only editable field
  recipeId: z.string().optional(),
  order: z.number().optional(), // order can still be updated via reorder endpoint
  // REMOVED: title, duration
});
```

_Note: The actual update schema for the lesson might just be `recipeId` if `order` is handled separately._

### MODIFIED: API Routes

Lesson management endpoints **MUST** be updated.

- **`POST /api/classes/:id/lessons`**
  - **Request Body**: **MUST** conform to the new `AddLessonToClassSchema`. It will only accept `recipeId`.
  - **Logic**: The service layer will no longer accept `title` or `duration`.
- **`PATCH /api/classes/:id/lessons/:lessonId`**
  - **Request Body**: **MUST** conform to the new `UpdateClassLessonSchema`. The only mutable field will be `recipeId`.
  - **Logic**: The service layer will only handle updates to `recipeId`.

### MODIFIED: Service and Repository Layer

The internal logic **MUST** be aligned with the schema changes.

- **`class.service.ts`**:
  - `addLesson`: The `AddLessonInput` interface and the method signature **MUST** be updated to remove `title` and `duration` and require `recipeId`.
  - `updateLesson`: The `UpdateLessonInput` interface and method signature **MUST** be updated to only allow changing `recipeId`.
- **`prisma-class-lesson.repository.ts`**:
  - The `create` and `update` methods **MUST** be updated to remove logic associated with `title` and `duration`.

### ADDED: Publication Validation

The system **MUST** prevent a class from being published if it contains lessons without a valid recipe.

- **File**: `apps/api/src/application/services/class.service.ts`
- **Method**: `publishClass`
- **Requirement**: Before creating a `ClassVersion`, the service **MUST** iterate through all `ClassLesson` entities associated with the class. If any `ClassLesson` has a missing or invalid `recipeId`, the operation **MUST** fail with a `ClassValidationError`.

#### Scenario: Tutor tries to publish a class with an invalid lesson

- **GIVEN** a tutor has a class in `DRAFT` status
- **AND** the class has one or more `ClassLesson` records with a `NULL` or invalid `recipeId`
- **WHEN** the tutor sends a request to `POST /api/classes/:id/publish`
- **THEN** the system **SHALL** respond with a `422 Unprocessable Entity` status
- **AND** the response body **SHALL** contain an error message like "All lessons must have a valid recipe before publishing."

---

## 4. Frontend Requirements (`frontend`)

### MODIFIED: Add/Edit Lesson Flow

The UI for managing lessons **MUST** be updated to handle recipe selection instead of manual title entry.

- **Component**: Lesson creation/editing modal/form.
- **Requirement**: The text input for "Lesson Title" and "Duration" **MUST** be removed.
- **Requirement**: A recipe selector (e.g., a searchable dropdown) **MUST** be added. This component **SHALL** list all available `Recipe` entities.
- **Requirement**: When creating a new lesson, the user **MUST** select a recipe. The `recipeId` is then sent to the backend.

### MODIFIED: Lesson Display

The way lessons are displayed within a class editor **MUST** be updated.

- **Component**: Class editor lesson list.
- **Requirement**: The lesson's title **MUST** be sourced from the associated `Recipe.title`.
- **Requirement**: The lesson's duration **MUST** be sourced from the associated `Recipe.expectedDurationMinutes`.
- **Requirement**: If a `ClassLesson` somehow has a `recipeId` that points to a non-existent recipe, the UI **SHOULD** display an error state for that lesson (e.g., "Invalid Recipe").

### ADDED: Frontend Publication Validation

The UI **SHOULD** provide immediate feedback if a user tries to publish an invalid class.

- **Component**: Class editor page, near the "Publish" button.
- **Requirement**: The "Publish" button **SHOULD** be disabled if the class has lessons without an assigned recipe.
- **Requirement**: If the button is not disabled, and the user clicks "Publish" on a class with invalid lessons, the UI **MUST** display a clear error message explaining why the action failed.

---

## 5. Shared Types Requirements (`shared`)

### MODIFIED: `ClassLesson` Schemas

The Zod schemas in the shared package **MUST** be updated to match the new backend DTOs and Prisma model.

**File**: `packages/shared/src/schemas/class.schema.ts`

**Current Schemas:**

```typescript
export const ClassLessonSchema = z.object({
  id: z.string(),
  classId: z.string(),
  recipeId: z.string().nullable().optional(),
  order: z.number(),
  title: z.string(),
  duration: z.number().nullable().optional(),
  // ...
});

export const ClassLessonCreateSchema = z.object({
  recipeId: z.string().optional(),
  order: z.number(),
  title: z.string(),
  duration: z.number().optional(),
});
```

**New Schemas:**

```typescript
export const ClassLessonSchema = z.object({
  id: z.string(),
  classId: z.string(),
  // MODIFIED: recipeId is now required
  recipeId: z.string(),
  order: z.number(),
  // REMOVED: title, duration
  // ...
  // ADDED: recipe relation for easy data access on front-end
  recipe: RecipeSchema.optional(), // Assuming a RecipeSchema exists
});

export const ClassLessonCreateSchema = z.object({
  // MODIFIED: recipeId is now required
  recipeId: z.string(),
  order: z.number(),
  // REMOVED: title, duration
});
```

The `ClassLessonUpdateSchema` **MUST** also be updated accordingly.

---

## 6. Scenarios

### Scenario 1: Tutor Creates a Class and Adds Lessons

- **GIVEN** a tutor is on the "Create Class" page
- **WHEN** they fill out the class title and description
- **AND** they click "Add Lesson"
- **AND** a modal appears with a searchable list of recipes
- **AND** they select the "Introduction to Algebra" recipe
- **AND** they click "Add"
- **THEN** a new lesson appears in the lesson list, displaying the title "Introduction to Algebra"
- **AND** the system has created a `ClassLesson` record linking the class and the selected recipe.

### Scenario 2: Tutor Attempts to Publish a Class with an Empty Lesson

- **GIVEN** a tutor created a class and somehow has a `ClassLesson` without a `recipeId` (due to old data or a bug)
- **WHEN** they click the "Publish" button
- **THEN** the backend **SHALL** reject the request with a `422` error.
- **AND** the frontend **SHALL** display a notification: "Cannot publish. All lessons must have a recipe assigned."

### Scenario 3: Tutor Edits a Lesson by Changing the Recipe

- **GIVEN** a tutor is editing a class that has a lesson "Introduction to Algebra"
- **WHEN** they click the "Edit" icon on that lesson
- **AND** they change the selected recipe from "Introduction to Algebra" to "Advanced Algebra" in the recipe selector
- **AND** they save the change
- **THEN** the lesson in the list now displays the title "Advanced Algebra"
- **AND** the underlying `ClassLesson` record's `recipeId` **MUST** be updated to point to the new recipe.
