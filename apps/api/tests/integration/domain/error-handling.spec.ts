/**
 * Integration Tests for Error Handling
 *
 * Tests cover:
 * - AppError class behavior
 * - Error mapping to HTTP responses
 * - Domain-specific error classes
 */

import {
  AppError,
  ErrorCodes,
  // Auth Errors
  InvalidCredentialsError,
  ForbiddenError,
  TokenExpiredError,
  ValidationError,
  // Recipe Errors
  RecipeNotFoundError,
  RecipeOwnershipError,
  RecipeInUseError,
  StepNotFoundError,
  // Class Errors
  ClassNotFoundError,
  ClassOwnershipError,
  ClassStateError,
  LessonNotFoundError,
  // Session Errors
  SessionNotFoundError,
  SessionAlreadyCompletedError,
  ActiveSessionExistsError,
} from '@/domain/errors/index.js';
import { mapErrorToResponse, getHttpStatus } from '@/infrastructure/http/error-mapper.js';

// ==================== Test Suite ====================

describe('Error Handling Integration Tests', () => {
  // ==================== AppError Base Class ====================

  describe('AppError Base Class', () => {
    it('should create error with all properties', () => {
      const error = new AppError('TEST_ERROR', 400, 'Test message', { field: 'value' });

      expect(error.code).toBe('TEST_ERROR');
      expect(error.httpStatus).toBe(400);
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ field: 'value' });
      expect(error.name).toBe('AppError');
    });

    it('should serialize to JSON', () => {
      const error = new AppError('TEST_ERROR', 400, 'Test message', { extra: 'data' });
      const json = error.toJSON();

      expect(json.code).toBe('TEST_ERROR');
      expect(json.httpStatus).toBe(400);
      expect(json.message).toBe('Test message');
      expect(json.details).toEqual({ extra: 'data' });
    });

    it('should be instance of Error', () => {
      const error = new AppError('TEST', 500, 'Error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ==================== Error Codes ====================

  describe('Error Codes', () => {
    it('should have all expected error codes', () => {
      // Auth
      expect(ErrorCodes.INVALID_CREDENTIALS).toBeDefined();
      expect(ErrorCodes.USER_NOT_FOUND).toBeDefined();
      expect(ErrorCodes.FORBIDDEN).toBeDefined();
      expect(ErrorCodes.TOKEN_EXPIRED).toBeDefined();

      // Recipe
      expect(ErrorCodes.RECIPE_NOT_FOUND).toBeDefined();
      expect(ErrorCodes.RECIPE_OWNERSHIP_ERROR).toBeDefined();

      // Class
      expect(ErrorCodes.CLASS_NOT_FOUND).toBeDefined();
      expect(ErrorCodes.CLASS_STATE_ERROR).toBeDefined();

      // Session
      expect(ErrorCodes.SESSION_NOT_FOUND).toBeDefined();
      expect(ErrorCodes.SESSION_ALREADY_COMPLETED).toBeDefined();
    });
  });

  // ==================== Auth Errors ====================

  describe('Auth Errors', () => {
    it('should create InvalidCredentialsError with correct status', () => {
      const error = new InvalidCredentialsError();

      expect(error.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
      expect(error.httpStatus).toBe(401);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(InvalidCredentialsError);
    });

    it('should create ForbiddenError with correct status', () => {
      const error = new ForbiddenError();

      expect(error.code).toBe(ErrorCodes.FORBIDDEN);
      expect(error.httpStatus).toBe(403);
    });

    it('should create TokenExpiredError with correct status', () => {
      const error = new TokenExpiredError();

      expect(error.code).toBe(ErrorCodes.TOKEN_EXPIRED);
      expect(error.httpStatus).toBe(401);
    });

    it('should create ValidationError with field errors', () => {
      const fieldErrors = { email: ['Invalid format'] };
      const error = new ValidationError('Validation failed', fieldErrors);

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.httpStatus).toBe(400);
      expect(error.fieldErrors).toEqual(fieldErrors);
    });
  });

  // ==================== Recipe Errors ====================

  describe('Recipe Errors', () => {
    it('should create RecipeNotFoundError with recipeId', () => {
      const error = new RecipeNotFoundError('recipe-123');

      expect(error.code).toBe(ErrorCodes.RECIPE_NOT_FOUND);
      expect(error.httpStatus).toBe(404);
      expect(error.recipeId).toBe('recipe-123');
      expect(error.message).toContain('recipe-123');
    });

    it('should create RecipeOwnershipError with recipeId and userId', () => {
      const error = new RecipeOwnershipError('recipe-123', 'user-456');

      expect(error.code).toBe(ErrorCodes.RECIPE_OWNERSHIP_ERROR);
      expect(error.httpStatus).toBe(403);
      expect(error.recipeId).toBe('recipe-123');
      expect(error.userId).toBe('user-456');
    });

    it('should create RecipeInUseError with 409 status', () => {
      const error = new RecipeInUseError('recipe-123');

      expect(error.code).toBe(ErrorCodes.RECIPE_IN_USE);
      expect(error.httpStatus).toBe(409);
    });

    it('should create StepNotFoundError with stepId', () => {
      const error = new StepNotFoundError('step-789');

      expect(error.code).toBe(ErrorCodes.STEP_NOT_FOUND);
      expect(error.httpStatus).toBe(404);
      expect(error.stepId).toBe('step-789');
    });
  });

  // ==================== Class Errors ====================

  describe('Class Errors', () => {
    it('should create ClassNotFoundError with classId', () => {
      const error = new ClassNotFoundError('class-123');

      expect(error.code).toBe(ErrorCodes.CLASS_NOT_FOUND);
      expect(error.httpStatus).toBe(404);
      expect(error.classId).toBe('class-123');
    });

    it('should create ClassOwnershipError with classId and userId', () => {
      const error = new ClassOwnershipError('class-123', 'user-456');

      expect(error.code).toBe(ErrorCodes.CLASS_OWNERSHIP_ERROR);
      expect(error.httpStatus).toBe(403);
    });

    it('should create ClassStateError with 409 status', () => {
      const error = new ClassStateError('class-123', 'Cannot edit published class');

      expect(error.code).toBe(ErrorCodes.CLASS_STATE_ERROR);
      expect(error.httpStatus).toBe(409);
      expect(error.classId).toBe('class-123');
    });

    it('should create LessonNotFoundError with lessonId', () => {
      const error = new LessonNotFoundError('lesson-789');

      expect(error.code).toBe(ErrorCodes.LESSON_NOT_FOUND);
      expect(error.httpStatus).toBe(404);
      expect(error.lessonId).toBe('lesson-789');
    });
  });

  // ==================== Session Errors ====================

  describe('Session Errors', () => {
    it('should create SessionNotFoundError with sessionId', () => {
      const error = new SessionNotFoundError('session-123');

      expect(error.code).toBe(ErrorCodes.SESSION_NOT_FOUND);
      expect(error.httpStatus).toBe(404);
      expect(error.sessionId).toBe('session-123');
    });

    it('should create SessionAlreadyCompletedError with 409 status', () => {
      const error = new SessionAlreadyCompletedError('session-123');

      expect(error.code).toBe(ErrorCodes.SESSION_ALREADY_COMPLETED);
      expect(error.httpStatus).toBe(409);
    });

    it('should create ActiveSessionExistsError with userId and recipeId', () => {
      const error = new ActiveSessionExistsError('user-123', 'recipe-456');

      expect(error.code).toBe(ErrorCodes.ACTIVE_SESSION_EXISTS);
      expect(error.httpStatus).toBe(409);
      expect(error.userId).toBe('user-123');
      expect(error.recipeId).toBe('recipe-456');
    });
  });

  // ==================== Error Mapper ====================

  describe('Error Mapper', () => {
    it('should map AppError to response', () => {
      const error = new RecipeNotFoundError('recipe-123');
      const response = mapErrorToResponse(error);

      expect(response.error).toContain('recipe-123');
      expect(response.code).toBe(ErrorCodes.RECIPE_NOT_FOUND);
    });

    it('should get HTTP status from AppError', () => {
      const error = new ForbiddenError();
      const status = getHttpStatus(error);

      expect(status).toBe(403);
    });

    it('should return 500 for unknown errors', () => {
      const error = new Error('Unknown error');
      const status = getHttpStatus(error);

      expect(status).toBe(500);
    });

    it('should return 500 for non-Error values', () => {
      const status = getHttpStatus('string error');

      expect(status).toBe(500);
    });
  });

  // ==================== Error Inheritance ====================

  describe('Error Inheritance', () => {
    it('should maintain proper inheritance chain for auth errors', () => {
      const error = new InvalidCredentialsError();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(InvalidCredentialsError);
    });

    it('should maintain proper inheritance chain for recipe errors', () => {
      const error = new RecipeNotFoundError('id');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(RecipeNotFoundError);
    });

    it('should maintain proper inheritance chain for class errors', () => {
      const error = new ClassStateError('id', 'message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ClassStateError);
    });
  });
});
