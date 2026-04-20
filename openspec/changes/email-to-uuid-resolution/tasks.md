# Tasks: Email to UUID Resolution

## Phase 1: Foundation / Infrastructure

- [ ] 1.1 Create file `apps/api/src/features/auth/application/use-cases/resolve-user-by-email.use-case.ts`
- [ ] 1.2 Modify `apps/api/src/features/auth/application/use-cases/index.ts` to export `ResolveUserByEmailUseCase`.
- [ ] 1.3 Modify `apps/api/src/features/auth/infrastructure/di/auth.container.ts` to instantiate and inject `ResolveUserByEmailUseCase`.

## Phase 2: Core Implementation

- [ ] 2.1 Implement `ResolveUserByEmailUseCase` in `apps/api/src/features/auth/application/use-cases/resolve-user-by-email.use-case.ts` to find user by email using `user.repository.ts`.
- [ ] 2.2 Add `resolveByEmail` method to `AuthController` in `apps/api/src/features/auth/infrastructure/http/auth.routes.ts`.
- [ ] 2.3 Implement request validation for `email` query parameter using `ResolveUserQuerySchema` within `resolveByEmail` controller method.

## Phase 3: Integration / Wiring

- [ ] 3.1 Add `GET /api/v1/auth/users/resolve` route to `auth.routes.ts`, mapping to `AuthController.resolveByEmail`.
- [ ] 3.2 Apply `requireRole('TEACHER')` middleware to the new `/resolve` route in `auth.routes.ts`.

## Phase 4: Testing

- [ ] 4.1 Write unit tests for `ResolveUserByEmailUseCase` (mock `IUserRepository`, test success, user not found).
- [ ] 4.2 Write integration tests for `GET /api/v1/auth/users/resolve` endpoint (`supertest`, test 200, 400, 401, 403, 404 scenarios).

## Phase 5: Cleanup

- [ ] 5.1 Review and add necessary JSDoc comments to public exports.
