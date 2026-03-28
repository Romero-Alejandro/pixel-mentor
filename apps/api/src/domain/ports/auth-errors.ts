/**
 * Auth Error Types
 *
 * Typed error classes for authentication and authorization flows.
 * These errors include HTTP status codes for proper API response mapping.
 */

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('INVALID_CREDENTIALS', 401, 'Credenciales inválidas');
  }
}

export class UserNotFoundError extends AuthError {
  constructor() {
    super('USER_NOT_FOUND', 404, 'Usuario no encontrado');
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor(field: string) {
    super('USER_ALREADY_EXISTS', 409, `Ya existe un usuario con este ${field}`);
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = 'No tienes permisos para realizar esta acción') {
    super('FORBIDDEN', 403, message);
  }
}

export class TokenExpiredError extends AuthError {
  constructor() {
    super('TOKEN_EXPIRED', 401, 'La sesión ha expirado');
  }
}

export class TokenInvalidError extends AuthError {
  constructor() {
    super('TOKEN_INVALID', 401, 'Sesión inválida');
  }
}

export class ValidationError extends AuthError {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super('VALIDATION_ERROR', 400, message);
  }
}
