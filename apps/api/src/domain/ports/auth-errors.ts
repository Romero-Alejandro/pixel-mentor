/**
 * Auth Error Types
 *
 * Re-exports from centralized error module for backward compatibility.
 * @deprecated Import from '@/domain/errors' instead
 */

export {
  AuthError,
  InvalidCredentialsError,
  UserNotFoundError,
  UserAlreadyExistsError,
  ForbiddenError,
  TokenExpiredError,
  TokenInvalidError,
  ValidationError,
} from '@/domain/errors/index.js';
