// Base error classes and codes
export { AppError, ErrorCodes } from '@/shared/errors/app-error.js';
export type { ErrorJSON, ErrorCode } from '@/shared/errors/app-error.js';

// Domain-specific error classes
export {
  // Base auth error
  AuthError,
  // Auth errors
  InvalidCredentialsError,
  UserNotFoundError,
  UserAlreadyExistsError,
  ForbiddenError,
  TokenExpiredError,
  TokenInvalidError,
  // Validation
  ValidationError,
  // Recipe errors
  RecipeNotFoundError,
  RecipeOwnershipError,
  RecipeInUseError,
  RecipeValidationError,
  StepNotFoundError,
  // Class errors
  ClassNotFoundError,
  ClassOwnershipError,
  ClassStateError,
  ClassValidationError,
  LessonNotFoundError,
  // Template errors
  TemplateNotFoundError,
  TemplateOwnershipError,
  // Session errors
  SessionNotFoundError,
  SessionAlreadyCompletedError,
  ActiveSessionExistsError,
  // Generic errors
  NotFoundError,
  InternalError,
} from '@/shared/errors/domain-errors.js';

// Schema validation error
export { SchemaValidationError } from '@/shared/errors/schema-validation.error.js';

// HTTP error
export { HttpError } from '@/shared/errors/http-error.js';
