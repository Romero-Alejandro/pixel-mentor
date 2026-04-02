// ==================== Domain-Specific Error Classes ====================

import { AppError, ErrorCodes } from './app-error.js';

// ==================== Authentication & Authorization Errors ====================

export class AuthError extends AppError {
  constructor(code: string, httpStatus: number, message: string) {
    super(code, httpStatus, message);
    this.name = 'AuthError';
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super(ErrorCodes.INVALID_CREDENTIALS, 401, 'Credenciales inválidas');
    this.name = 'InvalidCredentialsError';
  }
}

export class UserNotFoundError extends AuthError {
  constructor(userId?: string) {
    super(
      ErrorCodes.USER_NOT_FOUND,
      404,
      userId ? `Usuario no encontrado: ${userId}` : 'Usuario no encontrado',
    );
    this.name = 'UserNotFoundError';
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor(field: string) {
    super(ErrorCodes.USER_ALREADY_EXISTS, 409, `Ya existe un usuario con este ${field}`);
    this.name = 'UserAlreadyExistsError';
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = 'No tienes permisos para realizar esta acción') {
    super(ErrorCodes.FORBIDDEN, 403, message);
    this.name = 'ForbiddenError';
  }
}

export class TokenExpiredError extends AuthError {
  constructor() {
    super(ErrorCodes.TOKEN_EXPIRED, 401, 'La sesión ha expirado');
    this.name = 'TokenExpiredError';
  }
}

export class TokenInvalidError extends AuthError {
  constructor() {
    super(ErrorCodes.TOKEN_INVALID, 401, 'Sesión inválida');
    this.name = 'TokenInvalidError';
  }
}

// ==================== Validation Errors ====================

export class ValidationError extends AppError {
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(ErrorCodes.VALIDATION_ERROR, 400, message, fieldErrors);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

// ==================== Recipe Domain Errors ====================

export class RecipeNotFoundError extends AppError {
  public readonly recipeId: string;

  constructor(recipeId: string) {
    super(ErrorCodes.RECIPE_NOT_FOUND, 404, `Recipe with ID ${recipeId} not found`);
    this.name = 'RecipeNotFoundError';
    this.recipeId = recipeId;
  }
}

export class RecipeOwnershipError extends AppError {
  public readonly recipeId: string;
  public readonly userId: string;

  constructor(recipeId: string, userId: string) {
    super(
      ErrorCodes.RECIPE_OWNERSHIP_ERROR,
      403,
      `User ${userId} does not have permission to modify recipe ${recipeId}`,
    );
    this.name = 'RecipeOwnershipError';
    this.recipeId = recipeId;
    this.userId = userId;
  }
}

export class RecipeInUseError extends AppError {
  public readonly recipeId: string;

  constructor(recipeId: string) {
    super(
      ErrorCodes.RECIPE_IN_USE,
      409,
      `Recipe ${recipeId} is in use by lessons and cannot be deleted`,
    );
    this.name = 'RecipeInUseError';
    this.recipeId = recipeId;
  }
}

export class RecipeValidationError extends AppError {
  constructor(message: string) {
    super(ErrorCodes.RECIPE_VALIDATION_ERROR, 400, message);
    this.name = 'RecipeValidationError';
  }
}

export class StepNotFoundError extends AppError {
  public readonly stepId: string;

  constructor(stepId: string) {
    super(ErrorCodes.STEP_NOT_FOUND, 404, `Step with ID ${stepId} not found`);
    this.name = 'StepNotFoundError';
    this.stepId = stepId;
  }
}

// ==================== Class Domain Errors ====================

export class ClassNotFoundError extends AppError {
  public readonly classId: string;

  constructor(classId: string) {
    super(ErrorCodes.CLASS_NOT_FOUND, 404, `Class with ID ${classId} not found`);
    this.name = 'ClassNotFoundError';
    this.classId = classId;
  }
}

export class ClassOwnershipError extends AppError {
  public readonly classId: string;
  public readonly userId: string;

  constructor(classId: string, userId: string) {
    super(
      ErrorCodes.CLASS_OWNERSHIP_ERROR,
      403,
      `User ${userId} does not have permission to modify class ${classId}`,
    );
    this.name = 'ClassOwnershipError';
    this.classId = classId;
    this.userId = userId;
  }
}

export class ClassStateError extends AppError {
  public readonly classId: string;

  constructor(classId: string, message: string) {
    super(ErrorCodes.CLASS_STATE_ERROR, 409, message);
    this.name = 'ClassStateError';
    this.classId = classId;
  }
}

export class ClassValidationError extends AppError {
  constructor(message: string) {
    super(ErrorCodes.CLASS_VALIDATION_ERROR, 400, message);
    this.name = 'ClassValidationError';
  }
}

export class LessonNotFoundError extends AppError {
  public readonly lessonId: string;

  constructor(lessonId: string) {
    super(ErrorCodes.LESSON_NOT_FOUND, 404, `Lesson with ID ${lessonId} not found`);
    this.name = 'LessonNotFoundError';
    this.lessonId = lessonId;
  }
}

// ==================== Template Domain Errors ====================

export class TemplateNotFoundError extends AppError {
  public readonly templateId: string;

  constructor(templateId: string) {
    super(ErrorCodes.TEMPLATE_NOT_FOUND, 404, `Template with ID ${templateId} not found`);
    this.name = 'TemplateNotFoundError';
    this.templateId = templateId;
  }
}

export class TemplateOwnershipError extends AppError {
  public readonly templateId: string;
  public readonly userId: string;

  constructor(templateId: string, userId: string) {
    super(
      ErrorCodes.TEMPLATE_OWNERSHIP_ERROR,
      403,
      `User ${userId} does not have permission to modify template ${templateId}`,
    );
    this.name = 'TemplateOwnershipError';
    this.templateId = templateId;
    this.userId = userId;
  }
}

// ==================== Session Domain Errors ====================

export class SessionNotFoundError extends AppError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(ErrorCodes.SESSION_NOT_FOUND, 404, `Session with ID ${sessionId} not found`);
    this.name = 'SessionNotFoundError';
    this.sessionId = sessionId;
  }
}

export class SessionAlreadyCompletedError extends AppError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(ErrorCodes.SESSION_ALREADY_COMPLETED, 409, `Session ${sessionId} is already completed`);
    this.name = 'SessionAlreadyCompletedError';
    this.sessionId = sessionId;
  }
}

export class ActiveSessionExistsError extends AppError {
  public readonly userId: string;
  public readonly recipeId: string;

  constructor(userId: string, recipeId: string) {
    super(
      ErrorCodes.ACTIVE_SESSION_EXISTS,
      409,
      `User ${userId} already has an active session for recipe ${recipeId}`,
    );
    this.name = 'ActiveSessionExistsError';
    this.userId = userId;
    this.recipeId = recipeId;
  }
}

// ==================== Generic Errors ====================

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(ErrorCodes.NOT_FOUND, 404, `${resource} with ID ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super(ErrorCodes.INTERNAL_ERROR, 500, message);
    this.name = 'InternalError';
  }
}
