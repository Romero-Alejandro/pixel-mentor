// Domain layer
export * from '@/features/auth/domain/entities/index.js';
export * from '@/features/auth/domain/auth.errors.js';

// Re-export errors from ports (for backward compatibility)
export {
  UserNotFoundError,
  UserAlreadyExistsError,
  InvalidCredentialsError,
} from '@/features/auth/domain/ports/user.repository.port.js';

export {
  ApiKeyNotFoundError,
  ApiKeyInactiveError,
} from '@/features/auth/domain/ports/api-key.repository.port.js';

export {
  ParentalConsentNotFoundError,
  ConsentAlreadyGrantedError,
} from '@/features/auth/domain/ports/parental-consent.repository.port.js';

// Service ports (Dependency Rule - abstractions over infrastructure)
export * from '@/features/auth/domain/ports/hashing.service.port.js';
export * from '@/features/auth/domain/ports/token.service.port.js';

// Application layer
export * from '@/features/auth/application/use-cases/index.js';
export * from '@/features/auth/application/services/index.js';

// Infrastructure layer
export * from '@/features/auth/infrastructure/persistence/index.js';
export * from '@/features/auth/infrastructure/http/index.js';

// Adapters
export * from '@/features/auth/infrastructure/hashing.adapter.js';
export * from '@/features/auth/infrastructure/token.adapter.js';
