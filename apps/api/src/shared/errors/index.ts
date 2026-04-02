// Base error classes and codes
export { AppError, ErrorCodes } from './app-error.js';
export type { ErrorJSON, ErrorCode } from './app-error.js';

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
} from './domain-errors.js';

// Schema validation error
export { SchemaValidationError } from './schema-validation.error.js';

// HTTP error
export { HttpError } from './http-error.js';
