/**
 * Auth Error Types
 *
 * Centralized error definitions for the auth feature.
 */

export class AuthError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
  }
}

export class UserNotFoundError extends AuthError {
  readonly userId?: string;
  readonly userEmail?: string;

  constructor(identifier: string) {
    super(`User not found: ${identifier}`, 'USER_NOT_FOUND');
    this.name = 'UserNotFoundError';
    if (identifier.includes('@')) {
      this.userEmail = identifier;
    } else {
      this.userId = identifier;
    }
  }
}

export class UserAlreadyExistsError extends AuthError {
  readonly email: string;

  constructor(email: string) {
    super(`User with email ${email} already exists`, 'USER_ALREADY_EXISTS');
    this.name = 'UserAlreadyExistsError';
    this.email = email;
  }
}

export class ForbiddenError extends AuthError {
  constructor(message: string) {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class TokenExpiredError extends AuthError {
  constructor() {
    super('Token has expired', 'TOKEN_EXPIRED');
    this.name = 'TokenExpiredError';
  }
}

export class TokenInvalidError extends AuthError {
  constructor() {
    super('Token is invalid', 'TOKEN_INVALID');
    this.name = 'TokenInvalidError';
  }
}

export class ValidationError extends AuthError {
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}
