# Design: Email to UUID Resolution

## Technical Approach

Implement a new, protected API endpoint in the `auth` feature to resolve a user's email address to their UUID and role. The endpoint will be restricted to users with the `TEACHER` role. The implementation will follow the existing Hexagonal Architecture of the backend, adding a new use case and extending the `AuthController` and `AuthRouter`. No database schema changes are required.

## Architecture Decisions

### Decision: New Controller Method vs. New Controller

**Choice**: Add a new `resolveByEmail` method to the existing `AuthController`.
**Alternatives considered**: Creating a new `UserResolutionController`.
**Rationale**: The functionality is small and fits logically within the existing `AuthController`, which already handles user-related queries like `/me`. Creating a new controller would be overkill and add unnecessary boilerplate.

### Decision: Authorization Layer

**Choice**: Use the existing `requireRole` middleware factory to protect the endpoint.
**Alternatives considered**: Adding role-checking logic inside the controller method.
**Rationale**: The `requireRole` factory is a reusable, declarative, and standard way to handle authorization across the application. It keeps the controller's logic focused on the request/response cycle and business logic invocation, adhering to the Single Responsibility Principle.

## Data Flow

The data flow for a successful request will be:

```
   [Client]
      │
      │ 1. GET /api/v1/auth/users/resolve?email=...
      ▼
[Express Router]───►[authMiddleware]───►[requireRole('TEACHER')]
      │
      │ 2. Middleware validates token & role
      ▼
[AuthController.resolveByEmail]
      │
      │ 3. Validates query params (Zod)
      │ 4. Invokes use case: resolveByEmail.execute({ email })
      ▼
[ResolveUserByEmailUseCase]
      │
      │ 5. Calls repository: userRepo.findByEmail(email)
      ▼
[PrismaUserRepository]
      │
      │ 6. Queries DB: prisma.user.findUnique({ where: { email }})
      ▼
   [Database]
      │
      │ 7. Returns user record or null
      ▼
[PrismaUserRepository]
      │
      │ 8. Maps Prisma record to Domain Entity
      ▼
[ResolveUserByEmailUseCase]
      │
      │ 9. Returns User entity or throws UserNotFoundError
      ▼
[AuthController.resolveByEmail]
      │
      │ 10. Catches errors, formats success/error response
      ▼
   [Client]
```

## File Changes

| File                                                              | Action | Description                                                                 |
|-------------------------------------------------------------------|--------|-----------------------------------------------------------------------------|
| `apps/api/src/features/auth/application/use-cases/resolve-user-by-email.use-case.ts` | Create | Contains the business logic for looking up a user by their email.           |
| `apps/api/src/features/auth/application/use-cases/index.ts`       | Modify | Export the new `ResolveUserByEmailUseCase`.                                 |
| `apps/api/src/features/auth/infrastructure/http/auth.routes.ts`   | Modify | Add the new `resolveByEmail` controller method and the `/resolve` route.    |
| `apps/api/src/features/auth/infrastructure/di/auth.container.ts`  | Modify | Instantiate and inject the new `ResolveUserByEmailUseCase`.                 |

## Interfaces / Contracts

### API Endpoint

- **Endpoint**: `GET /api/v1/auth/users/resolve`
- **Query Parameters**:
  - `email` (string, required, must be a valid email format)
- **Authorization**: `Bearer <token>` required. User must have `TEACHER` role.

### Request Validation (Zod)
```typescript
const ResolveUserQuerySchema = z.object({
  email: z.string().email('A valid email is required'),
});
```

### Success Response (200 OK)
```json
{
  "id": "clxye3s0s000008l5he0w4g7q",
  "role": "STUDENT"
}
```

### Error Responses

- **400 Bad Request**: Invalid email format.
- **401 Unauthorized**: Token is missing, invalid, or expired.
- **403 Forbidden**: Authenticated user is not a `TEACHER`.
- **404 Not Found**: No user found with the provided email.

### Use Case Interface
```typescript
// apps/api/src/features/auth/application/use-cases/resolve-user-by-email.use-case.ts
export interface ResolveUserInput {
  email: string;
}

export interface ResolveUserOutput {
  id: string;
  role: string;
}

export class ResolveUserByEmailUseCase {
  // ... constructor
  async execute(input: ResolveUserInput): Promise<ResolveUserOutput>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `ResolveUserByEmailUseCase` | Mock `IUserRepository`. Test that it calls `findByEmail` and correctly returns the mapped user data. Test that it throws `UserNotFoundError` if the repository returns `null`. |
| Integration | `auth.routes.ts` | Use an in-memory test server (e.g., `supertest`). Test the `GET /resolve` endpoint. Verify success (200) for a valid teacher, forbidden (403) for a student, not found (404) for a non-existent email, and unauthorized (401) without a token. |
| E2E | Student Enrollment | (Out of scope for this backend-focused design, but would be covered by frontend tasks) A Playwright test would simulate a teacher logging in, navigating to the group management page, and successfully adding a student via email. |

## Migration / Rollout

No migration required. This change is additive. The new endpoint can be deployed, and the frontend can adopt it in a subsequent release.

## Open Questions

- None.
