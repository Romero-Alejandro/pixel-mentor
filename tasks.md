# Tasks: auth-system-overhaul

## Phase 1: Database and Shared Schema Foundation

- [ ] 1.1 **Prisma Schema Migration: Add `username` to User model & create `RefreshToken` model.**
  - Description: Add `username` field (unique, string, optional for existing users) to the `User` model and create a new `RefreshToken` model to `prisma/schema.prisma`.
  - Files to modify: `apps/api/prisma/schema.prisma`
  - Dependencies: None
  - Estimated complexity: Medium
- [ ] 1.2 **Prisma Schema Migration: Generate migration file.**
  - Description: Generate a new Prisma migration file to apply schema changes.
  - Files to modify: `apps/api/prisma/migrations/*`
  - Dependencies: 1.1
  - Estimated complexity: Small
- [ ] 1.3 **Shared Package: Update `User` type to include `username` and `role`.**
  - Description: Modify the `User` type definition in the shared package to include the new `username` field and ensure `role` is defined.
  - Files to modify: `packages/shared/src/schemas/auth.ts` (or relevant user type definition file)
  - Dependencies: 1.1
  - Estimated complexity: Small
- [ ] 1.4 **Shared Package: Update `LoginSchema` with `identifier` field.**
  - Description: Adjust the `LoginSchema` to accept a generic `identifier` field that can be either an email or a username.
  - Files to modify: `packages/shared/src/schemas/auth.ts`
  - Dependencies: None
  - Estimated complexity: Small

## Phase 2: Domain Layer Enhancements

- [ ] 2.1 **Domain Layer: Add `username` to `User` entity interface.**
  - Description: Update the `User` entity interface to include the `username` property.
  - Files to modify: `apps/api/src/domain/user/User.ts`
  - Dependencies: 1.3
  - Estimated complexity: Small
- [ ] 2.2 **Domain Layer: Add `findByIdentifier` to `UserRepository` port.**
  - Description: Define a new method `findByIdentifier(identifier: string): Promise<User | null>` in the `UserRepository` interface.
  - Files to modify: `apps/api/src/domain/user/UserRepository.ts`
  - Dependencies: 2.1
  - Estimated complexity: Small
- [ ] 2.3 **Domain Layer: Create `AuthError` error types.**
  - Description: Implement custom error classes for authentication-related errors, such as `UserNotFound`, `InvalidCredentials`, and `Unauthorized`.
  - Files to modify: `apps/api/src/domain/errors/AuthError.ts` (new file)
  - Dependencies: None
  - Estimated complexity: Medium

## Phase 3: Application Layer Logic Updates

- [ ] 3.1 **Application Layer: Update `LoginUseCase` for identifier-based login.**
  - Description: Modify the `LoginUseCase` to accept an `identifier` (email or username) and use the `UserRepository.findByIdentifier` method.
  - Files to modify: `apps/api/src/application/use-cases/auth/LoginUseCase.ts`
  - Dependencies: 2.2, 2.3
  - Estimated complexity: Medium
- [ ] 3.2 **Application Layer: Update `RegisterUseCase` to force `STUDENT` role.**
  - Description: Ensure that the `RegisterUseCase` assigns the `STUDENT` role to all new users, preventing role elevation during registration.
  - Files to modify: `apps/api/src/application/use-cases/auth/RegisterUseCase.ts`
  - Dependencies: None
  - Estimated complexity: Small
- [ ] 3.3 **Application Layer: Add error code handling in `LoginUseCase` and `RegisterUseCase`.**
  - Description: Implement specific error handling with appropriate `AuthError` types and corresponding error codes for login and registration failures.
  - Files to modify: `apps/api/src/application/use-cases/auth/LoginUseCase.ts`, `apps/api/src/application/use-cases/auth/RegisterUseCase.ts`
  - Dependencies: 2.3, 3.1, 3.2
  - Estimated complexity: Medium

## Phase 4: Infrastructure Layer Implementation

- [ ] 4.1 **Infrastructure Layer: Update `PrismaUserRepository` with `findByIdentifier`.**
  - Description: Implement the `findByIdentifier` method in `PrismaUserRepository` to query the database using either email or username.
  - Files to modify: `apps/api/src/infrastructure/repositories/PrismaUserRepository.ts`
  - Dependencies: 1.1, 2.2
  - Estimated complexity: Medium
- [ ] 4.2 **Infrastructure Layer: Create `requireRole` middleware.**
  - Description: Develop an Express middleware `requireRole` that checks if the authenticated user has one of the specified roles.
  - Files to modify: `apps/api/src/infrastructure/http/middlewares/requireRole.ts` (new file)
  - Dependencies: None
  - Estimated complexity: Medium
- [ ] 4.3 **Infrastructure Layer: Update `AuthController` for new schemas and error handling.**
  - Description: Adjust `AuthController` to use the updated `LoginSchema` and integrate the new `AuthError` handling.
  - Files to modify: `apps/api/src/infrastructure/http/controllers/AuthController.ts`
  - Dependencies: 1.4, 3.1, 3.3
  - Estimated complexity: Medium
- [ ] 4.4 **Infrastructure Layer: Fix duplicate route mounting in `server.ts`.**
  - Description: Address any duplicate route definitions in `server.ts` to ensure clean and correct routing.
  - Files to modify: `apps/api/src/infrastructure/http/server.ts`
  - Dependencies: None
  - Estimated complexity: Small
- [ ] 4.5 **Infrastructure Layer: Update class routes to use `requireRole` middleware.**
  - Description: Replace existing inline role checks in class-related routes with the new `requireRole` middleware.
  - Files to modify: `apps/api/src/infrastructure/http/routes/classes.ts` (and potentially other route files)
  - Dependencies: 4.2
  - Estimated complexity: Large

## Phase 5: Frontend Integration

- [ ] 5.1 **Frontend: Update `authStore` login signature.**
  - Description: Adjust the `login` action in the `authStore` to accept an `identifier` instead of separate email/username.
  - Files to modify: `apps/web/src/stores/authStore.ts`
  - Dependencies: 1.4
  - Estimated complexity: Small
- [ ] 5.2 **Frontend: Update `LoginPage` UI and logic.**
  - Description: Modify the `LoginPage` to allow users to input either email or username for login and reflect the backend changes.
  - Files to modify: `apps/web/src/pages/LoginPage.tsx`
  - Dependencies: 5.1
  - Estimated complexity: Medium
- [ ] 5.3 **Frontend: Update `api.ts` service for new login endpoint.**
  - Description: Ensure the `api.ts` service correctly sends the `identifier` to the backend login endpoint.
  - Files to modify: `apps/web/src/services/api.ts`
  - Dependencies: 1.4
  - Estimated complexity: Small

## Phase 6: Verification and Testing

- [ ] 6.1 **Backend Testing: Add unit tests for `LoginUseCase` identifier logic.**
  - Description: Write unit tests to cover successful and failed login scenarios using both email and username as identifiers.
  - Files to modify: `apps/api/src/application/use-cases/auth/LoginUseCase.test.ts`
  - Dependencies: 3.1
  - Estimated complexity: Medium
- [ ] 6.2 **Backend Testing: Add unit tests for `requireRole` middleware.**
  - Description: Write unit tests for the `requireRole` middleware to ensure correct authorization based on user roles.
  - Files to modify: `apps/api/src/infrastructure/http/middlewares/requireRole.test.ts` (new file)
  - Dependencies: 4.2
  - Estimated complexity: Medium
- [ ] 6.3 **Backend Testing: Add integration tests for login with identifier.**
  - Description: Create integration tests to verify the end-to-end login flow using email and username, including token generation.
  - Files to modify: `apps/api/src/infrastructure/http/controllers/AuthController.test.ts`
  - Dependencies: 4.3
  - Estimated complexity: Medium
- [ ] 6.4 **Frontend Testing: Update `LoginPage` E2E tests.**
  - Description: Adjust existing E2E tests for the `LoginPage` or create new ones to cover login with both email and username.
  - Files to modify: `apps/web/e2e/LoginPage.spec.ts`
  - Dependencies: 5.2
  - Estimated complexity: Medium
