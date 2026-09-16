import {
  SessionError,
  SessionNotFoundError,
  SessionNotActiveError,
  SessionAlreadyCompletedError,
  RecipeNotFoundError,
  RecipeHasNoStepsError,
  AtomNotFoundError,
  LLMTimeoutError,
  LLMChunkTimeoutError,
  LLMServiceError,
  StreamingConnectionError,
  StreamingDisabledError,
  SessionLockedError,
  InvalidInputError,
  SessionEscalatedError,
  getUserErrorMessage,
  getErrorCode,
  SESSION_ERROR_CODES,
} from '@/features/recipe/domain/errors/session.errors.js';

describe('Session Errors', () => {
  describe('SessionError (base)', () => {
    it('should have all required properties', () => {
      const error = new SessionError('TEST_ERROR', 'Test message', 'User friendly message', 400, {
        key: 'value',
      });

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.userMessage).toBe('User friendly message');
      expect(error.statusCode).toBe(400);
      expect(error.metadata).toEqual({ key: 'value' });
      expect(error.name).toBe('SessionError');
    });

    it('should default statusCode to 500', () => {
      const error = new SessionError('TEST', 'msg', 'user msg');
      expect(error.statusCode).toBe(500);
    });

    it('should be instanceof Error', () => {
      const error = new SessionError('TEST', 'msg', 'user msg');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('SessionNotFoundError', () => {
    it('should have correct properties', () => {
      const error = new SessionNotFoundError('session-123');

      expect(error.code).toBe('SESSION_NOT_FOUND');
      expect(error.sessionId).toBe('session-123');
      expect(error.statusCode).toBe(404);
      expect(error.userMessage).toContain('sesion');
    });
  });

  describe('SessionNotActiveError', () => {
    it('should have correct properties', () => {
      const error = new SessionNotActiveError('session-123', 'COMPLETED');

      expect(error.code).toBe('SESSION_NOT_ACTIVE');
      expect(error.sessionId).toBe('session-123');
      expect(error.currentStatus).toBe('COMPLETED');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('SessionAlreadyCompletedError', () => {
    it('should have correct properties', () => {
      const error = new SessionAlreadyCompletedError('session-123');

      expect(error.code).toBe('SESSION_ALREADY_COMPLETED');
      expect(error.sessionId).toBe('session-123');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('RecipeNotFoundError', () => {
    it('should have correct properties', () => {
      const error = new RecipeNotFoundError('recipe-456');

      expect(error.code).toBe('RECIPE_NOT_FOUND');
      expect(error.recipeId).toBe('recipe-456');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('RecipeHasNoStepsError', () => {
    it('should have correct properties', () => {
      const error = new RecipeHasNoStepsError('recipe-456');

      expect(error.code).toBe('RECIPE_HAS_NO_STEPS');
      expect(error.recipeId).toBe('recipe-456');
      expect(error.statusCode).toBe(422);
    });
  });

  describe('AtomNotFoundError', () => {
    it('should have correct properties', () => {
      const error = new AtomNotFoundError('atom-789', 3);

      expect(error.code).toBe('ATOM_NOT_FOUND');
      expect(error.atomId).toBe('atom-789');
      expect(error.stepIndex).toBe(3);
      expect(error.statusCode).toBe(422);
    });
  });

  describe('LLMTimeoutError', () => {
    it('should have correct properties', () => {
      const error = new LLMTimeoutError(30000);

      expect(error.code).toBe('LLM_TIMEOUT');
      expect(error.timeoutMs).toBe(30000);
      expect(error.statusCode).toBe(504);
    });
  });

  describe('LLMChunkTimeoutError', () => {
    it('should have correct properties', () => {
      const error = new LLMChunkTimeoutError();

      expect(error.code).toBe('LLM_CHUNK_TIMEOUT');
      expect(error.statusCode).toBe(504);
    });
  });

  describe('LLMServiceError', () => {
    it('should have correct properties', () => {
      const error = new LLMServiceError('Rate limited', 'openai');

      expect(error.code).toBe('LLM_SERVICE_ERROR');
      expect(error.provider).toBe('openai');
      expect(error.statusCode).toBe(502);
    });
  });

  describe('StreamingConnectionError', () => {
    it('should have correct properties', () => {
      const error = new StreamingConnectionError('Connection dropped');

      expect(error.code).toBe('STREAMING_CONNECTION_ERROR');
      expect(error.statusCode).toBe(503);
    });

    it('should have default message', () => {
      const error = new StreamingConnectionError();
      expect(error.message).toContain('Connection lost');
    });
  });

  describe('StreamingDisabledError', () => {
    it('should have correct properties', () => {
      const error = new StreamingDisabledError();

      expect(error.code).toBe('STREAMING_DISABLED');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('SessionLockedError', () => {
    it('should have correct properties', () => {
      const error = new SessionLockedError('session-123');

      expect(error.code).toBe('SESSION_LOCKED');
      expect(error.sessionId).toBe('session-123');
      expect(error.statusCode).toBe(429);
    });
  });

  describe('InvalidInputError', () => {
    it('should have correct properties', () => {
      const error = new InvalidInputError('studentInput', 'too long');

      expect(error.code).toBe('INVALID_INPUT');
      expect(error.field).toBe('studentInput');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('SessionEscalatedError', () => {
    it('should have correct properties', () => {
      const error = new SessionEscalatedError('session-123', 'safety concern');

      expect(error.code).toBe('SESSION_ESCALATED');
      expect(error.sessionId).toBe('session-123');
      expect(error.reason).toBe('safety concern');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('getUserErrorMessage', () => {
    it('should return userMessage for SessionError', () => {
      const error = new SessionNotFoundError('session-123');
      expect(getUserErrorMessage(error)).toBe(error.userMessage);
    });

    it('should return generic message for unknown Error', () => {
      const error = new Error('Something went wrong');
      expect(getUserErrorMessage(error)).toBe('Ocurrio un error inesperado. Intenta de nuevo.');
    });

    it('should return connection message for network errors', () => {
      const error = new Error('Network error');
      expect(getUserErrorMessage(error)).toBe('Error de conexion. Verifica tu internet.');
    });

    it('should handle non-Error values', () => {
      expect(getUserErrorMessage('string error')).toBe(
        'Ocurrio un error inesperado. Intenta de nuevo.',
      );
      expect(getUserErrorMessage(null)).toBe('Ocurrio un error inesperado. Intenta de nuevo.');
      expect(getUserErrorMessage(undefined)).toBe('Ocurrio un error inesperado. Intenta de nuevo.');
    });
  });

  describe('getErrorCode', () => {
    it('should return code for SessionError', () => {
      const error = new SessionNotFoundError('session-123');
      expect(getErrorCode(error)).toBe('SESSION_NOT_FOUND');
    });

    it('should return UNKNOWN_ERROR for non-SessionError', () => {
      expect(getErrorCode(new Error('test'))).toBe('UNKNOWN_ERROR');
      expect(getErrorCode('string')).toBe('UNKNOWN_ERROR');
      expect(getErrorCode(null)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('SESSION_ERROR_CODES', () => {
    it('should contain all error codes', () => {
      expect(SESSION_ERROR_CODES.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND');
      expect(SESSION_ERROR_CODES.SESSION_NOT_ACTIVE).toBe('SESSION_NOT_ACTIVE');
      expect(SESSION_ERROR_CODES.LLM_TIMEOUT).toBe('LLM_TIMEOUT');
      expect(SESSION_ERROR_CODES.STREAMING_CONNECTION_ERROR).toBe('STREAMING_CONNECTION_ERROR');
    });
  });

  describe('Error inheritance chain', () => {
    it('all specific errors should be instanceof SessionError', () => {
      const errors = [
        new SessionNotFoundError('id'),
        new SessionNotActiveError('id', 'ACTIVE'),
        new SessionAlreadyCompletedError('id'),
        new RecipeNotFoundError('id'),
        new RecipeHasNoStepsError('id'),
        new AtomNotFoundError('id', 0),
        new LLMTimeoutError(1000),
        new LLMChunkTimeoutError(),
        new LLMServiceError('msg'),
        new StreamingConnectionError(),
        new StreamingDisabledError(),
        new SessionLockedError('id'),
        new InvalidInputError('field', 'reason'),
        new SessionEscalatedError('id'),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(SessionError);
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
