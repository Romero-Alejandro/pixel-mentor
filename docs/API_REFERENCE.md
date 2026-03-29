# Pixel Mentor API Reference

## Introduction

The Pixel Mentor API is a RESTful backend service that powers an intelligent tutoring platform for children aged 6-12. The API provides endpoints for class management, recipe (lesson) orchestration, session tracking, gamification, AI-powered features, and administrative tasks.

**Base URL:** `https://your-domain.com/api` (or `http://localhost:3001/api` in development)

**Authentication:** All endpoints except `/auth/*` require Bearer token authentication. Include the JWT token in the `Authorization` header:

```bash
Authorization: Bearer <your_jwt_token>
```

**User Roles:**

- `STUDENT` — Can interact with sessions and view own data
- `TEACHER` — Can create/manage classes, recipes, templates
- `ADMIN` — Full system access including user management

**Format:** All request/response bodies use JSON. Dates are ISO 8601 strings. UUIDs follow standard format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

---

## Global Conventions

### Error Responses

| Status Code | Description                       | Response Body Example                                               |
| ----------- | --------------------------------- | ------------------------------------------------------------------- |
| `400`       | Validation error                  | `{ "error": "Validation error", "details": [...] }`                 |
| `401`       | Missing or invalid authentication | `{ "error": "Unauthorized" }`                                       |
| `403`       | Insufficient permissions          | `{ "error": "Forbidden: ..." }`                                     |
| `404`       | Resource not found                | `{ "error": "Not found", "code": "RESOURCE_NOT_FOUND" }`            |
| `409`       | Conflict (e.g., delete in use)    | `{ "error": "Conflict", "code": "IN_USE" }`                         |
| `422`       | Business rule validation          | `{ "error": "Validation error", "code": "CLASS_VALIDATION_ERROR" }` |
| `500`       | Internal server error             | `{ "error": "Internal server error" }`                              |

### Pagination

Endpoints that return lists support pagination via query parameters:

- `page` (integer, ≥ 1): Page number, default `1`
- `limit` (integer, 1-100): Items per page, default `20`

**Paginated Response Format:**

```json
{
  "items": [...],
  "total": 150,
  "page": 2,
  "limit": 20,
  "totalPages": 8
}
```

### Date Formats

All dates are returned as ISO 8601 strings in UTC:

```json
{
  "createdAt": "2025-03-20T14:30:00.000Z",
  "updatedAt": "2025-03-21T09:15:00.000Z"
}
```

### UUID Format

All resource IDs are UUIDs. They must be provided in standard format:

```
12345678-1234-1234-1234-123456789012
```

---

## Authentication

### `POST /api/auth/register` — Register New User

**Public endpoint — no auth required**

Registers a new user account.

**Request Body:**

| Field      | Type   | Validation                                      |
| ---------- | ------ | ----------------------------------------------- |
| `email`    | string | Required, valid email format                    |
| `password` | string | Required, min 6 characters                      |
| `name`     | string | Required, min 1, max 100 chars                  |
| `username` | string | Optional, 3-30 chars, alphanumeric + underscore |
| `age`      | number | Optional, positive integer                      |

**Response (201 Created):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "username": "johndoe",
    "role": "STUDENT",
    "age": 25,
    "createdAt": "2025-03-20T14:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Example cURL:**

```bash
curl -X POST https://api.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@school.edu",
    "password": "secure123",
    "name": "Maria Garcia",
    "role": "TEACHER",
    "age": 35
  }'
```

---

### `POST /api/auth/login` — Login

**Public endpoint — no auth required**

Authenticates user and returns JWT token.

**Request Body:**

| Field        | Type   | Validation                  |
| ------------ | ------ | --------------------------- |
| `identifier` | string | Required, email or username |
| `password`   | string | Required, min 1 char        |

**Response (200 OK):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "TEACHER"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**

- `401` — Invalid credentials: `{ "error": "Credenciales inválidas", "code": "INVALID_CREDENTIALS" }`

**Example cURL:**

```bash
curl -X POST https://api.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "teacher@school.edu",
    "password": "secure123"
  }'
```

---

### `GET /api/auth/me` — Get Current User

**Protected — any authenticated user**

Returns the authenticated user's profile.

**Headers:**

```bash
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "TEACHER",
    "age": 35,
    "createdAt": "2025-03-20T14:30:00.000Z"
  }
}
```

**Errors:**

- `401` — Not authenticated
- `404` — User not found

---

## Classes

Class management endpoints for teachers to create and manage course classes.

### `POST /api/classes` — Create Class

**Protected — TEACHER or ADMIN**

Creates a new draft class.

**Request Body:**

| Field                | Type             | Validation                           |
| -------------------- | ---------------- | ------------------------------------ |
| `title`              | string           | Required, min 1, max 255 chars       |
| `description`        | string           | Optional, max 1000 chars             |
| `classTemplateId`    | string (UUID)    | Optional — template to base class on |
| `lessons`            | array of objects | Optional — initial lessons to add    |
| `lessons[].recipeId` | string           | Required per lesson                  |
| `lessons[].order`    | number (integer) | Optional — defaults to array index   |

**Response (201 Created):**

```json
{
  "id": "class-uuid",
  "tutorId": "teacher-uuid",
  "title": "Science 101",
  "description": "Introduction to photosynthesis",
  "status": "DRAFT",
  "lessons": [
    {
      "id": "lesson-uuid",
      "recipeId": "recipe-uuid",
      "order": 0
    }
  ],
  "createdAt": "2025-03-20T14:30:00.000Z",
  "updatedAt": "2025-03-20T14:30:00.000Z"
}
```

---

### `GET /api/classes` — List Classes

**Protected — TEACHER or ADMIN**

Lists classes for the authenticated teacher (or all classes for ADMIN).

**Query Parameters:**

| Field     | Type                                           | Default               |
| --------- | ---------------------------------------------- | --------------------- |
| `status`  | enum: DRAFT, UNDER_REVIEW, PUBLISHED, ARCHIVED | Optional filter       |
| `tutorId` | string (UUID)                                  | Optional — ADMIN only |
| `page`    | number (≥1)                                    | Default 1             |
| `limit`   | number (1-100)                                 | Default 20            |

**Response (200 OK):**

```json
{
  "items": [
    {
      "id": "class-uuid",
      "title": "Science 101",
      "status": "PUBLISHED",
      "lessonCount": 5,
      "createdAt": "2025-03-20T14:30:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20,
  "totalPages": 2
}
```

---

### `GET /api/classes/:id` — Get Class Details

**Protected — TEACHER (own) or ADMIN**

Retrieves full class details including all lessons.

**Path Parameters:**

- `id` — Class UUID

**Response (200 OK):**

```json
{
  "id": "class-uuid",
  "tutorId": "teacher-uuid",
  "title": "Science 101",
  "description": "Introduction to photosynthesis",
  "status": "PUBLISHED",
  "lessons": [
    {
      "id": "lesson-uuid",
      "recipeId": "recipe-uuid",
      "order": 0,
      "recipe": {
        "id": "recipe-uuid",
        "title": "Photosynthesis Basics",
        "steps": [...]
      }
    }
  ],
  "createdAt": "2025-03-20T14:30:00.000Z",
  "updatedAt": "2025-03-20T14:30:00.000Z"
}
```

**Errors:**

- `404` — Class not found
- `403` — Not owner (unless ADMIN)

---

### `PATCH /api/classes/:id` — Update Class

**Protected — TEACHER (own) or ADMIN**

Updates class metadata (title, description). Cannot change lessons via this endpoint.

**Path Parameters:**

- `id` — Class UUID

**Request Body:**

| Field             | Type   | Validation                              |
| ----------------- | ------ | --------------------------------------- |
| `title`           | string | Optional, min 1, max 255                |
| `description`     | string | Optional, max 1000 chars                |
| `classTemplateId` | string | Optional — cannot change after creation |

**Response (200 OK):** Updated class object (same structure as GET)

**Errors:**

- `400` — Validation error
- `404` — Class not found
- `403` — Not owner
- `409` — Class state conflict (e.g., archived class cannot be updated)

---

### `DELETE /api/classes/:id` — Delete Class

**Protected — TEACHER (own) or ADMIN**

Permanently deletes a class. Only allowed for DRAFT classes; published classes must be archived first.

**Path Parameters:**

- `id` — Class UUID

**Response:**

- `204 No Content` — Success (empty body)

**Errors:**

- `404` — Class not found
- `403` — Not owner
- `409` — Cannot delete (wrong state)

---

### `POST /api/classes/:id/publish` — Publish Class

**Protected — TEACHER (own) or ADMIN**

Changes class status from DRAFT to PUBLISHED. Validates that class has at least one lesson with an associated recipe.

**Path Parameters:**

- `id` — Class UUID

**Response (200 OK):** Updated class object with `status: "PUBLISHED"`

**Errors:**

- `404` — Class not found
- `403` — Not owner
- `409` — Cannot publish (missing lessons, invalid state)
- `422` — Business validation failed

---

### `POST /api/classes/:id/unpublish` — Unpublish Class

**Protected — TEACHER (own) or ADMIN**

Reverts published class back to DRAFT status.

**Path Parameters:**

- `id` — Class UUID

**Response (200 OK):** Updated class object with `status: "DRAFT"`

**Errors:**

- `404` — Class not found
- `403` — Not owner
- `409` — Cannot unpublish

---

### `POST /api/classes/:id/lessons` — Add Lesson

**Protected — TEACHER (own) or ADMIN**

Adds a recipe as a lesson to the class.

**Path Parameters:**

- `id` — Class UUID

**Request Body:**

| Field      | Type                | Validation                      |
| ---------- | ------------------- | ------------------------------- |
| `recipeId` | string              | Required — existing recipe UUID |
| `order`    | number (integer ≥0) | Optional — defaults to max+1    |

**Response (201 Created):**

```json
{
  "id": "lesson-uuid",
  "classId": "class-uuid",
  "recipeId": "recipe-uuid",
  "order": 2,
  "createdAt": "2025-03-20T14:30:00.000Z"
}
```

**Errors:**

- `400` — Validation error
- `404` — Class not found
- `403` — Not owner
- `409` — Class state conflict (must be DRAFT)
- `404` — Recipe not found

---

### `PATCH /api/classes/:id/lessons/reorder` — Reorder Lessons

**Protected — TEACHER (own) or ADMIN**

Reorders all lessons in a class. The order of recipe IDs determines new order.

**Path Parameters:**

- `id` — Class UUID

**Request Body:**

| Field       | Type             | Validation                                         |
| ----------- | ---------------- | -------------------------------------------------- |
| `lessonIds` | array of strings | Required — all class lesson UUIDs in desired order |

**Response (200 OK):**

```json
{
  "message": "Lessons reordered successfully"
}
```

**Errors:**

- `400` — Validation error
- `404` — Class not found
- `403` — Not owner
- `409` — Class state conflict
- `404` — One or more lessons not found

---

### `DELETE /api/classes/:id/lessons/:lessonId` — Remove Lesson

**Protected — TEACHER (own) or ADMIN**

Removes a lesson from a class.

**Path Parameters:**

- `id` — Class UUID
- `lessonId` — Lesson UUID (from class.lessons[].id)

**Response:**

- `204 No Content`

**Errors:**

- `404` — Class or lesson not found
- `403` — Not owner
- `409` — Class state conflict

---

### `PATCH /api/classes/:id/lessons/:lessonId` — Update Lesson

**Protected — TEACHER (own) or ADMIN**

Updates a lesson's recipe or order.

**Path Parameters:**

- `id` — Class UUID
- `lessonId` — Lesson UUID

**Request Body:**

| Field      | Type                | Validation                 |
| ---------- | ------------------- | -------------------------- |
| `recipeId` | string              | Optional — new recipe UUID |
| `order`    | number (integer ≥0) | Optional — new order       |

**Response (200 OK):** Updated lesson object

**Errors:**

- `400` — Validation error
- `404` — Class, lesson, or recipe not found
- `403` — Not owner
- `409` — Class state conflict

---

### `POST /api/classes/:id/demo` — Start Demo Session

**Protected — TEACHER or ADMIN**

Starts an unrestricted demo session for the class's first lesson. Useful for previewing the class as a student.

**Path Parameters:**

- `id` — Class UUID

**Response (200 OK):**

```json
{
  "sessionId": "session-uuid",
  "recipeId": "recipe-uuid",
  "mode": "demo"
}
```

**Errors:**

- `400` — Class has no lessons
- `404` — Class not found
- `403` — Not owner or admin
- `500` — Failed to start session

---

## Class Templates

Template management for reusable class structures.

### `GET /api/class-templates` — List Templates

**Protected — TEACHER or ADMIN**

Lists templates owned by the authenticated teacher.

**Query Parameters:** (validated for security, but service doesn't support filtering yet)

- `status` — Optional enum
- `page` — Default 1
- `limit` — Default 20, max 100

**Response (200 OK):**

```json
{
  "templates": [
    {
      "id": "template-uuid",
      "tutorId": "teacher-uuid",
      "name": "Intro to Biology",
      "description": "Template for 1st grade biology",
      "createdAt": "2025-03-20T14:30:00.000Z"
    }
  ]
}
```

---

### `POST /api/class-templates` — Create Template

**Protected — TEACHER or ADMIN**

Creates a new class template from scratch.

**Request Body:**

| Field         | Type   | Validation               |
| ------------- | ------ | ------------------------ |
| `name`        | string | Required, min 1, max 255 |
| `description` | string | Optional, max 1000 chars |

**Response (201 Created):** Template object (same as list)

---

### `GET /api/class-templates/:id` — Get Template Details

**Protected — TEACHER (own) or ADMIN**

Retrieves template details.

**Path Parameters:**

- `id` — Template UUID

**Response (200 OK):** Template object with full details

**Errors:**

- `400` — Validation error (invalid UUID)
- `404` — Template not found
- `403` — Not owner

---

### `PATCH /api/class-templates/:id` — Update Template

**Protected — TEACHER (own) or ADMIN**

Updates template metadata.

**Path Parameters:**

- `id` — Template UUID

**Request Body:** Same as create (all fields optional)

**Response (200 OK):** Updated template object

**Errors:** Similar to GET

---

### `DELETE /api/class-templates/:id` — Delete Template

**Protected — TEACHER (own) or ADMIN**

Permanently deletes a template.

**Path Parameters:**

- `id` — Template UUID

**Response:**

- `204 No Content`

**Errors:**

- `404` — Not found
- `403` — Not owner
- `409` — Template in use (cannot delete)

---

### `POST /api/class-templates/:id/create-class` — Create Class from Template

**Protected — TEACHER or ADMIN**

Instantiates a new class based on a template. Copies all template's lesson structure.

**Path Parameters:**

- `id` — Template UUID

**Request Body (optional):**

| Field         | Type   | Validation               |
| ------------- | ------ | ------------------------ |
| `title`       | string | Optional, min 1, max 255 |
| `description` | string | Optional, max 1000 chars |

If provided, overrides template's name/description for the new class.

**Response (201 Created):**

```json
{
  "classId": "new-class-uuid",
  "title": "Science 101" // Final class title
}
```

**Errors:**

- `400` — Validation error
- `404` — Template not found
- `403` — Not owner

---

## Recipes (Lessons)

Recipe (unidad) management — the static pedagogical content.

### `GET /api/recipes/:id` — Get Recipe

**Protected — TEACHER or ADMIN (recipe owner) or STUDENT (if recipe published)**

Retrieves a recipe with all its steps.

**Path Parameters:**

- `id` — Recipe UUID

**Response (200 OK):**

```json
{
  "id": "recipe-uuid",
  "canonicalId": "Recipe:science-photosynthesis-v1",
  "title": "Photosynthesis Basics",
  "description": "Students learn how plants make food",
  "expectedDurationMinutes": 15,
  "version": "1.0.0",
  "published": true,
  "moduleId": "module-uuid" | null,
  "steps": [
    {
      "id": "step-uuid",
      "recipeId": "recipe-uuid",
      "atomId": "atom-uuid" | null,
      "order": 0,
      "stepType": "content",
      "script": {
        "transition": { "text": "Let's learn about..." },
        "content": {
          "text": "Photosynthesis is...",
          "chunks": [
            { "text": "Photosynthesis is how plants eat", "pauseAfter": 1000 }
          ]
        },
        "examples": [
          { "text": "Plants need sunlight", "visual": { "type": "image", "src": "url" } }
        ],
        "closure": { "text": "Now you know!" }
      },
      "activity": null,
      "question": null,
      "createdAt": "2025-03-20T14:30:00.000Z"
    }
  ],
  "createdAt": "2025-03-20T14:30:00.000Z",
  "updatedAt": "2025-03-20T14:30:00.000Z"
}
```

**Step Types:**

- `content` — Scripted lesson content (has `script`)
- `activity` — Interactive multiple-choice (has `activity`)
- `question` — Open-ended question (has `question`)
- `intro` / `closure` — Special scripted steps

**Errors:**

- `400` — Invalid UUID format
- `404` — Recipe not found or access denied

---

### `GET /api/recipes` — List Recipes

**Protected — TEACHER or ADMIN**

Lists all recipes visible to the user. Optionally filters to published only.

**Query Parameters:**

| Field        | Type    | Default                                 |
| ------------ | ------- | --------------------------------------- |
| `activeOnly` | boolean | Default `true` — only published recipes |

**Response (200 OK):**

```json
[
  {
    "id": "recipe-uuid",
    "title": "Photosynthesis Basics",
    "description": "...",
    "version": "1.0.0",
    "published": true,
    "expectedDurationMinutes": 15,
    "createdAt": "2025-03-20T14:30:00.000Z",
    "updatedAt": "2025-03-20T14:30:00.000Z"
  }
]
```

---

### `POST /api/recipes` — Create Recipe

**Protected — TEACHER (owner) or ADMIN**

Creates a new recipe with optional initial steps.

**Request Body:**

| Field                     | Type                             | Validation                |
| ------------------------- | -------------------------------- | ------------------------- |
| `title`                   | string                           | Required, min 1, max 255  |
| `description`             | string                           | Optional, max 1000 chars  |
| `expectedDurationMinutes` | number (integer, 1-480)          | Optional                  |
| `moduleId`                | string (UUID)                    | Optional                  |
| `published`               | boolean                          | Optional, default `false` |
| `steps`                   | array of RecipeStepInput objects | Optional                  |

**RecipeStepInput fields:**

| Field        | Type                                              | Validation                                 |
| ------------ | ------------------------------------------------- | ------------------------------------------ |
| `atomId`     | string (UUID)                                     | Optional                                   |
| `order`      | number (integer ≥0)                               | Optional                                   |
| `conceptId`  | string (UUID)                                     | Optional                                   |
| `activityId` | string (UUID)                                     | Optional                                   |
| `stepType`   | enum: content, activity, question, intro, closure | Default `content`                          |
| `script`     | StepScript object                                 | Required if stepType=content/intro/closure |
| `activity`   | ActivityContent2 object                           | Required if stepType=activity              |
| `question`   | Question object                                   | Required if stepType=question              |

See DTO schemas in `apps/api/src/application/dto/index.ts` for full step script structure.

**Response (201 Created):** Recipe object with all steps and IDs

---

### `PATCH /api/recipes/:id` — Update Recipe

**Protected — TEACHER (owner) or ADMIN**

Updates recipe metadata (not steps). Cannot change published status if in use by active sessions.

**Path Parameters:**

- `id` — Recipe UUID

**Request Body:** (all fields optional)

| Field                     | Type             | Validation     |
| ------------------------- | ---------------- | -------------- |
| `title`                   | string           | Min 1, max 255 |
| `description`             | string           | Max 1000 chars |
| `expectedDurationMinutes` | number (integer) | Min 1, max 480 |
| `moduleId`                | string (UUID)    | Optional       |
| `published`               | boolean          | Optional       |

**Response (200 OK):** Updated recipe object (steps not included)

**Errors:**

- `400` — Validation error
- `404` — Recipe not found
- `403` — Not owner
- `409` — Recipe in use by active sessions (cannot modify)

---

### `DELETE /api/recipes/:id` — Delete Recipe

**Protected — TEACHER (owner) or ADMIN**

Permanently deletes a recipe. Fails if recipe is referenced by any class or active session.

**Path Parameters:**

- `id` — Recipe UUID

**Response:**

- `204 No Content`

**Errors:**

- `404` — Recipe not found
- `403` — Not owner
- `409` — Recipe in use (`{ "error": "...", "code": "RECIPE_IN_USE" }`)

---

### `POST /api/recipes/:id/steps` — Add Step

**Protected — TEACHER (owner) or ADMIN**

Adds a new step to the recipe. Steps are automatically assigned order values if not provided.

**Path Parameters:**

- `id` — Recipe UUID

**Request Body:** RecipeStepInput (see Create Recipe above for schema). Must provide either:

- `script` for content/intro/closure steps
- `activity` for activity steps
- `question` for question steps

**Response (201 Created):** Step object with assigned ID

```json
{
  "id": "step-uuid",
  "recipeId": "recipe-uuid",
  "atomId": null,
  "order": 2,
  "stepType": "activity",
  "activity": { ... },
  "question": null,
  "script": null,
  "createdAt": "2025-03-20T14:30:00.000Z"
}
```

**Errors:**

- `400` — Validation error (missing content for stepType)
- `404` — Recipe not found or no permission
- `403` — Not owner

---

### `PATCH /api/recipes/:id/steps/:stepId` — Update Step

**Protected — TEACHER (owner) or ADMIN**

Updates a step's content, order, or associations.

**Path Parameters:**

- `id` — Recipe UUID
- `stepId` — Step UUID

**Request Body:** RecipeStepInput (same validation as Add Step)

**Response (200 OK):** Updated step object

**Errors:** Same as Add Step, plus:

- `404` — Step not found

---

### `DELETE /api/recipes/:id/steps/:stepId` — Delete Step

**Protected — TEACHER (owner) or ADMIN**

Removes a step from the recipe.

**Path Parameters:**

- `id` — Recipe UUID
- `stepId` — Step UUID

**Response:**

- `204 No Content`

**Errors:**

- `404` — Recipe or step not found
- `403` — Not owner

---

### `PATCH /api/recipes/:id/steps/reorder` — Reorder Steps

**Protected — TEACHER (owner) or ADMIN**

Reorders steps by providing the desired sequence of step IDs.

**Path Parameters:**

- `id` — Recipe UUID

**Request Body:**

| Field     | Type             | Validation                                        |
| --------- | ---------------- | ------------------------------------------------- |
| `stepIds` | array of strings | Required — all recipe step UUIDs in desired order |

**Response:**

- `204 No Content`

**Errors:**

- `400` — Validation error
- `404` — Recipe or step not found
- `403` — Not owner

---

## Sessions

Student session management — tracks progress through a recipe.

### `GET /api/sessions/:id` — Get Session

**Protected — Session owner (student) or ADMIN**

Retrieves session state, including current step and progress.

**Path Parameters:**

- `id` — Session UUID

**Response (200 OK):**

```json
{
  "id": "session-uuid",
  "studentId": "student-uuid",
  "recipeId": "recipe-uuid",
  "status": "ACTIVE",
  "currentStep": 3,
  "totalSteps": 10,
  "startedAt": "2025-03-20T14:30:00.000Z",
  "lastActivityAt": "2025-03-20T14:32:00.000Z",
  "completedAt": null
}
```

**Errors:**

- `400` — Invalid UUID
- `404` — Session not found
- `403` — Not session owner

---

### `GET /api/sessions` — List Sessions

**Protected — STUDENT (own) or ADMIN or TEACHER (with studentId filter)**

Lists sessions. Teachers must provide `studentId` to see a specific student's sessions.

**Query Parameters:**

| Field        | Type          | Default                                            |
| ------------ | ------------- | -------------------------------------------------- |
| `studentId`  | string (UUID) | Optional — required for TEACHER role               |
| `activeOnly` | boolean       | Default `false` — only include incomplete sessions |

**Response (200 OK):**

```json
[
  {
    "id": "session-uuid",
    "studentId": "student-uuid",
    "recipeId": "recipe-uuid",
    "status": "COMPLETED",
    "currentStep": 10,
    "totalSteps": 10,
    "startedAt": "2025-03-20T14:30:00.000Z",
    "completedAt": "2025-03-20T14:45:00.000Z"
  }
]
```

**Errors:**

- `400` — Validation error
- `403` — Teacher without studentId filter

---

### `POST /api/sessions/:id/replay` — Replay Session

**Protected — Session owner (student) or ADMIN**

Resets an active session back to the beginning (deletes current state and restarts).

**Path Parameters:**

- `id` — Session UUID

**Response (200 OK):** Fresh session object with same recipe, `currentStep: 0`

**Errors:**

- `400` — Invalid UUID
- `404` — Session not found
- `403` — Not owner

---

### `POST /api/sessions/:id/complete` — Complete Session

**Protected — Session owner (student) or ADMIN**

Manually marks a session as completed. Typically called when the student finishes the last step or the teacher terminates early.

**Path Parameters:**

- `id` — Session UUID

**Response (200 OK):** Updated session with `status: "COMPLETED"` and `completedAt` timestamp

**Errors:**

- `400` — Invalid UUID
- `404` — Session not found
- `403` — Not owner

---

## Gamification

Endpoints for user gamification profile, badges, and real-time events.

### `GET /api/gamification/profile` — Get Gamification Profile

**Protected — Authenticated user**

Returns the user's current gamification statistics.

**Response (200 OK):**

```json
{
  "userId": "student-uuid",
  "totalXP": 1250,
  "currentLevel": 3,
  "currentStreak": 5,
  "longestStreak": 12,
  "levelTitle": "Explorer",
  "xpToNextLevel": 250,
  "badges": [
    {
      "code": "first-steps",
      "name": "First Steps",
      "description": "Complete your first lesson",
      "icon": "🌟",
      "earnedAt": "2025-03-15T10:00:00.000Z",
      "xpReward": 50
    }
  ]
}
```

---

### `POST /api/gamification/xp/add` — Record Activity

**Protected — Authenticated user**

Records a gamification event and triggers XP/badge/level updates. Emits real-time events via SSE.

**Request Body:**

| Field     | Type                                                  | Required |
| --------- | ----------------------------------------------------- | -------- |
| `type`    | enum: LESSON_COMPLETED, ACTIVITY_ATTEMPT, DAILY_LOGIN | Yes      |
| `payload` | object (optional)                                     | No       |

**Payload fields depend on type:**

- **LESSON_COMPLETED:** `lessonId` (string, optional), `lessonTitle` (string, optional)
- **ACTIVITY_ATTEMPT:** `activityId` (string, optional), `correct` (boolean, optional), `attemptNumber` (positive integer, optional), `hintUsed` (boolean, optional)
- **DAILY_LOGIN:** (no payload fields)

**Response (200 OK):**

```json
{
  "success": true,
  "profile": {
    "userId": "...",
    "totalXP": 1300,
    "currentLevel": 3,
    ...
  },
  "levelUp": false,
  "newBadges": []
}
```

The profile reflects updated XP and level after the event.

---

### `GET /api/gamification/badges` — List All Badge Definitions

**Protected — Authenticated user**

Returns all available badge definitions (not just earned ones).

**Response (200 OK):**

```json
{
  "badges": [
    {
      "code": "first-steps",
      "name": "First Steps",
      "description": "Complete your first lesson",
      "icon": "🌟",
      "xpReward": 50,
      "requirement": {
        "type": "LESSONS_COMPLETED",
        "target": 1
      }
    }
  ]
}
```

---

### `GET /api/gamification/badges/user` — Get User's Badges

**Protected — Authenticated user**

Returns badges earned by the user.

**Response (200 OK):**

```json
{
  "badges": [
    {
      "code": "first-steps",
      "name": "First Steps",
      "icon": "🌟",
      "earnedAt": "2025-03-15T10:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/gamification/streak-history` — Get Streak History

**Protected — Authenticated user**

Returns the user's activity streak data for the last 90 days.

**Response (200 OK):**

```json
{
  "currentStreak": 5,
  "longestStreak": 12,
  "lastActivityAt": "2025-03-20T14:30:00.000Z",
  "history": [
    { "date": "2025-03-20", "active": true },
    { "date": "2025-03-19", "active": true }
    // ... 90 days total
  ]
}
```

---

### `GET /api/gamification/progress` — Get Badge & Level Progress

**Protected — Authenticated user**

Returns detailed progress toward next level and badge completion.

**Response (200 OK):**

```json
{
  "profile": {
    /* same as /profile */
  },
  "levelInfo": {
    "level": 3,
    "title": "Explorer",
    "minXP": 1000,
    "icon": "🧭"
  },
  "nextLevelInfo": {
    "level": 4,
    "title": "Adventurer",
    "minXP": 1500,
    "icon": "⚔️"
  },
  "badgeProgress": [
    {
      "badge": {
        "code": "perfect-week",
        "name": "Perfect Week",
        "description": "...",
        "icon": "🏆",
        "xpReward": 100,
        "requirement": {
          "type": "STREAK_DAYS",
          "target": 7
        }
      },
      "current": 5,
      "target": 7,
      "percentage": 71,
      "isEarned": false
    }
  ]
}
```

---

### `GET /api/gamification/mission-report/:sessionId` — Session Completion Report

**Protected — Authenticated user (must own session)**

Provides a comprehensive report of gamification gains from a completed session.

**Path Parameters:**

- `sessionId` — Session UUID (must be completed)

**Response (200 OK):**

```json
{
  "xpEarned": 150,
  "totalXP": 1400,
  "currentLevel": 3,
  "levelTitle": "Explorer",
  "xpToNextLevel": 100,
  "newBadges": [
    {
      "code": "quick-learner",
      "name": "Quick Learner",
      "icon": "⚡",
      "xpReward": 50
    }
  ],
  "levelUp": null,
  "streakDays": 5,
  "conceptsMastered": ["Photosynthesis", "Chlorophyll"]
}
```

**Errors:**

- `400` — Session not completed
- `403` — Not session owner
- `404` — Session not found

---

## Gamification Events (SSE)

**`GET /api/gamification/events` — Real-time Event Stream**

**Protected — Authenticated user**

Server-Sent Events (SSE) endpoint that streams gamification events in real time.

**Headers Sent:**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Events:**

Each SSE message is a JSON object with a `type` field:

| type             | Description               | Fields                                                                                                |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `xp_earned`      | XP points added           | `{ "type": "xp_earned", "amount": 50, "newTotal": 1250, "reason": "LESSON_COMPLETED" }`               |
| `badge_earned`   | New badge unlocked        | `{ "type": "badge_earned", "badge": { "code": "...", "name": "...", "icon": "...", "xpReward": 0 } }` |
| `level_up`       | User leveled up           | `{ "type": "level_up", "newLevel": 4, "newLevelTitle": "Adventurer", "previousLevel": 3 }`            |
| `streak_updated` | Streak count changed      | `{ "type": "streak_updated", "currentStreak": 6, "longestStreak": 12 }`                               |
| `:heartbeat`     | Keep-alive ping (comment) | Sent every 30 seconds                                                                                 |

**Connection Lifecycle:**

- Client connects and receives `:connected` event
- Client receives events as they occur
- Client can disconnect anytime; server cleans up subscriptions

**Example cURL:**

```bash
curl -N -H "Authorization: Bearer <token>" https://api.example.com/api/gamification/events
```

---

## Admin

Administrative user management. **All endpoints require ADMIN role.**

### `POST /api/admin/users` — Create User

**ADMIN only**

Creates any user type (STUDENT, TEACHER, ADMIN).

**Request Body:**

| Field      | Type                          | Validation                        |
| ---------- | ----------------------------- | --------------------------------- |
| `email`    | string                        | Required, valid email             |
| `password` | string                        | Required, min 6 chars             |
| `name`     | string                        | Required, min 1, max 100          |
| `username` | string                        | Optional, 3-30, alphanumeric + \_ |
| `role`     | enum: STUDENT, TEACHER, ADMIN | Required                          |
| `age`      | number                        | Optional, positive integer        |

**Response (201 Created):**

```json
{
  "user": {
    "id": "uuid",
    "email": "...",
    "name": "...",
    "username": "...",
    "role": "STUDENT",
    "age": 25,
    "createdAt": "2025-03-20T14:30:00.000Z"
  }
}
```

**Errors:**

- `400` — Validation error (Spanish messages)
- `409` — User already exists (by email or username)

---

### `GET /api/admin/users` — List Users

**ADMIN only**

Paginated list with optional filters.

**Query Parameters:**

| Field    | Type                          | Default                                     |
| -------- | ----------------------------- | ------------------------------------------- |
| `role`   | enum: STUDENT, TEACHER, ADMIN | Optional                                    |
| `search` | string                        | Optional — matches name, email, or username |
| `page`   | number (≥1)                   | Default 1                                   |
| `limit`  | number (1-100)                | Default 20                                  |

**Response (200 OK):**

```json
{
  "users": [
    /* user objects without sensitive fields */
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

---

### `GET /api/admin/users/:id` — Get User Details

**ADMIN only**

Retrieves full user profile.

**Path Parameters:**

- `id` — User UUID

**Response (200 OK):**

```json
{
  "user": {
    "id": "uuid",
    "email": "...",
    "name": "...",
    "username": "...",
    "role": "TEACHER",
    "age": 35,
    "createdAt": "2025-03-20T14:30:00.000Z"
  }
}
```

**Errors:**

- `400` — Invalid UUID
- `404` — User not found

---

### `PATCH /api/admin/users/:id/role` — Change User Role

**ADMIN only**

Updates a user's role.

**Path Parameters:**

- `id` — User UUID

**Request Body:**

| Field  | Type                          | Validation |
| ------ | ----------------------------- | ---------- |
| `role` | enum: STUDENT, TEACHER, ADMIN | Required   |

**Response (200 OK):** Updated user object

**Security:**

- Cannot change own role
- Role changes may be restricted based on business rules

**Errors:**

- `400` — Validation error
- `404` — User not found
- `403` — Forbidden (self-change or protected role)
- `409` — Conflict (e.g., demoting last admin)

---

### `DELETE /api/admin/users/:id` — Delete User

**ADMIN only**

Permanently deletes a user account.

**Path Parameters:**

- `id` — User UUID

**Response:**

- `204 No Content`

**Security:**

- Cannot delete own account

**Errors:**

- `400` — Invalid UUID
- `404` — User not found
- `403` — Forbidden (self-deletion)

---

## AI Features

AI-powered endpoints for generating content and getting suggestions.

### `POST /api/ai/generate-recipe` — Generate Recipe Draft

**Protected — TEACHER or ADMIN**

Uses AI to generate a recipe draft based on topic and objectives. Returns an incomplete recipe that must be reviewed and filled in.

**Request Body:**

| Field          | Type          | Validation                |
| -------------- | ------------- | ------------------------- |
| `topic`        | string        | Required, min 1, max 500  |
| `targetAgeMin` | number (3-18) | Required                  |
| `targetAgeMax` | number (3-18) | Required                  |
| `objectives`   | string[]      | Required, 1-10 objectives |

**Response (200 OK):**

```json
{
  "id": "recipe-uuid",
  "title": "Generated Recipe Title",
  "description": "AI-generated description...",
  "steps": [
    {
      "order": 0,
      "stepType": "intro",
      "script": {
        /* partial */
      }
    }
    // ... more steps
  ],
  "version": "draft",
  "published": false
}
```

Note: Generated recipes are saved as drafts and may have missing content that requires teacher review.

**Errors:**

- `400` — Validation error
- `403` — Not TEACHER/ADMIN
- `500` — AI service failure

---

### `POST /api/classes/ai/generate` — Generate Class Draft

**Protected — TEACHER or ADMIN**

Generates a complete class structure with suggested lessons based on a topic.

**Request Body:**

| Field              | Type             | Validation                                 |
| ------------------ | ---------------- | ------------------------------------------ |
| `topic`            | string           | Required, min 1, max 500                   |
| `targetAgeMin`     | number (3-18)    | Required                                   |
| `targetAgeMax`     | number (3-18)    | Required                                   |
| `objectives`       | string[]         | Required, 3-10 objectives                  |
| `duration`         | number (15-180)  | Optional — total class duration in minutes |
| `availableRecipes` | array of objects | Optional — existing recipes to include     |

`availableRecipes` format:

```json
[{ "id": "recipe-uuid", "title": "...", "description": "..." }]
```

**Response (200 OK):**

```json
{
  "title": "Generated Class Title",
  "description": "AI-generated class description...",
  "suggestedLessons": [
    {
      "recipeId": "recipe-uuid",
      "title": "Lesson 1",
      "order": 0,
      "source": "ai_generated"
    }
  ],
  "duration": 45,
  "objectives": [...]
}
```

The generated class is not automatically saved; the teacher must explicitly create it.

**Errors:**

- `400` — Validation error
- `403` — Not TEACHER/ADMIN
- `500` — AI service failure

---

### `GET /api/classes/:id/ai/suggestions` — Get Improvement Suggestions

**Protected — TEACHER (own) or ADMIN**

Analyzes a published class and returns AI-generated suggestions for improvement.

**Path Parameters:**

- `id` — Class UUID

**Response (200 OK):**

```json
{
  "suggestions": [
    {
      "type": "CONTENT_GAP",
      "severity": "MEDIUM",
      "title": "Consider adding a review activity",
      "description": "The lesson flow lacks a recap. Adding a summary activity could reinforce learning.",
      "location": "After lesson 3"
    },
    {
      "type": "PACING",
      "severity": "LOW",
      "title": "Lesson 2 may be too long",
      "description": "At 22 minutes, this lesson exceeds the optimal 15-18 minute window for this age group.",
      "location": "Lesson 2"
    }
  ]
}
```

**Errors:**

- `404` — Class not found
- `403` — Not owner
- `500` — AI service unavailable

---

## TTS (Text-to-Speech)

Text-to-speech streaming endpoint.

### `GET /api/tts/stream` — Stream Audio

**Protected — Authenticated user** (may be made public for specific use cases)

Streams synthesized speech as Server-Sent Events (SSE). Accepts plain text input.

**Query Parameters:**

| Field  | Type    | Default                                          | Description                     |
| ------ | ------- | ------------------------------------------------ | ------------------------------- |
| `text` | string  | **Required**                                     | Text to synthesize (min 1 char) |
| `lang` | string  | Optional — language code, e.g., `es-ES`, `en-US` |
| `slow` | boolean | Optional — `true` for slower speech              |

**Response:** SSE stream with chunks of audio data (format depends on TTS provider)

**Error Events:**

```javascript
event: error
data: { "message": "Error message", "code": "ERROR_CODE" }
```

**Stream Lifecycle:**

- Client connects, server begins streaming chunks
- Each `data` event contains an audio chunk
- When finished, server sends `event: end` or simply closes connection
- On error, server sends error event and terminates

**Example cURL:**

```bash
curl -N -H "Authorization: Bearer <token>" \
  "https://api.example.com/api/tts/stream?text=Hola%20como%20est%C3%A1s&lang=es-ES"
```

**Errors:**

- `400` — Missing text parameter
- `500` — TTS service failure

---

## Health Check

**`GET /api/health` — Service Health**

Public endpoint (no auth required) that returns service status.

**Response (200 OK):**

```json
{
  "status": "healthy",
  "timestamp": "2025-03-20T14:30:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "ai": "healthy",
    "tts": "healthy"
  }
}
```

---

## Rate Limiting

**Note:** Rate limits are configured at the server level (typically via middleware) and may vary by endpoint:

- Authentication endpoints: 5 attempts per 15 minutes per IP
- Write operations: 100 requests per minute per user
- Read operations: 500 requests per minute per user
- TTS streaming: 10 concurrent streams per user

Rate limit responses:

```json
{
  "error": "Too many requests",
  "code": "RATE_LIMITED",
  "retryAfter": 900
}
```

---

## Versioning

The API is versioned implicitly via the `/api` prefix. Breaking changes will be introduced under a new prefix (e.g., `/api/v2/...`) while maintaining backward compatibility for at least 6 months.

---

## Additional Resources

- **Backend Repository:** `apps/api/` in the Pixel Mentor monorepo
- **Shared Types:** `packages/shared/` for cross-package interfaces
- **Database Schema:** See `apps/api/prisma/schema.prisma`
- **Internal Docs:** See `docs/ai/` for architecture and coding standards

---

_Last updated: 2026-03-29_
