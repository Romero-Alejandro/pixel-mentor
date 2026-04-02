// Domain layer
export * from './domain/entities/index.js';
export * from './domain/auth.errors.js';

// Re-export errors from ports (for backward compatibility)
export {
  UserNotFoundError,
  UserAlreadyExistsError,
  InvalidCredentialsError,
} from './domain/ports/user.repository.port.js';

export {
  ApiKeyNotFoundError,
  ApiKeyInactiveError,
} from './domain/ports/api-key.repository.port.js';

export {
  ParentalConsentNotFoundError,
  ConsentAlreadyGrantedError,
} from './domain/ports/parental-consent.repository.port.js';

// Service ports (Dependency Rule - abstractions over infrastructure)
export * from './domain/ports/hashing.service.port.js';
export * from './domain/ports/token.service.port.js';

// Application layer
export * from './application/use-cases/index.js';
export * from './application/services/index.js';

// Infrastructure layer
export * from './infrastructure/persistence/index.js';
export * from './infrastructure/http/index.js';

// Adapters
export * from './infrastructure/hashing.adapter.js';
export * from './infrastructure/token.adapter.js';
