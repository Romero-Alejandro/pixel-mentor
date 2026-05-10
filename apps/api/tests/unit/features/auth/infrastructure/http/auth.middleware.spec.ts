import type { Response, NextFunction } from 'express';

// Mock config so we can control NODE_ENV
jest.mock('@/shared/config/index.js', () => ({
  config: {
    NODE_ENV: 'development',
  },
}));

const { config } = require('@/shared/config/index.js');

import {
  authMiddleware,
  requireRole,
  type AuthRequest,
} from '@/features/auth/infrastructure/http/auth.middleware.js';
import type { VerifyTokenUseCase } from '@/features/auth/application/use-cases/verify-token.use-case.js';
import {
  TokenInvalidError,
  TokenExpiredError,
  UserNotFoundError,
} from '@/features/auth/domain/auth.errors.js';

const createMockVerifyTokenUseCase = (): jest.Mocked<VerifyTokenUseCase> =>
  ({
    execute: jest.fn(),
  }) as unknown as jest.Mocked<VerifyTokenUseCase>;

const createMockResponse = (): jest.Mocked<Response> => {
  const res: Partial<jest.Mocked<Response>> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as jest.Mocked<Response>;
};

const createMockRequest = (
  overrides: Partial<AuthRequest> = {},
): AuthRequest & {
  headers: Record<string, string | undefined>;
  query: Record<string, unknown>;
} => {
  return {
    headers: {},
    query: {},
    ...overrides,
  } as AuthRequest & {
    headers: Record<string, string | undefined>;
    query: Record<string, unknown>;
  };
};

describe('authMiddleware', () => {
  let verifyTokenUseCase: jest.Mocked<VerifyTokenUseCase>;
  let middleware: ReturnType<typeof authMiddleware>;
  let req: ReturnType<typeof createMockRequest>;
  let res: ReturnType<typeof createMockResponse>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    verifyTokenUseCase = createMockVerifyTokenUseCase();
    middleware = authMiddleware(verifyTokenUseCase);
    req = createMockRequest();
    res = createMockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('with Bearer token', () => {
    it('should authenticate user with valid Bearer token', async () => {
      // Given
      req.headers.authorization = 'Bearer valid-token';
      verifyTokenUseCase.execute.mockResolvedValue({
        payload: {
          userId: 'user-123',
          email: 'test@example.com',
          role: 'ADMIN',
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'ADMIN',
        },
      });

      // When
      await middleware(req, res, next);

      // Then
      expect(verifyTokenUseCase.execute).toHaveBeenCalledWith('valid-token');
      expect(req.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 when token is missing', async () => {
      // Given
      req.headers.authorization = undefined;

      // When
      await middleware(req, res, next);

      // Then
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No se proporcionó token de autenticación',
        code: 'TOKEN_MISSING',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is not Bearer', async () => {
      // Given
      req.headers.authorization = 'Basic some-credentials';

      // When
      await middleware(req, res, next);

      // Then
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No se proporcionó token de autenticación',
        code: 'TOKEN_MISSING',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token verification fails with TokenInvalidError', async () => {
      // Given
      req.headers.authorization = 'Bearer invalid-token';
      verifyTokenUseCase.execute.mockRejectedValue(new TokenInvalidError());

      // When
      await middleware(req, res, next);

      // Then
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token inválido',
        code: 'TOKEN_INVALID',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired (TokenExpiredError)', async () => {
      // Given
      req.headers.authorization = 'Bearer expired-token';
      verifyTokenUseCase.execute.mockRejectedValue(new TokenExpiredError());

      // When
      await middleware(req, res, next);

      // Then
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'La sesión ha expirado',
        code: 'TOKEN_EXPIRED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not found after token verification', async () => {
      // Given
      req.headers.authorization = 'Bearer valid-token';
      verifyTokenUseCase.execute.mockRejectedValue(new UserNotFoundError('nonexistent'));

      // When
      await middleware(req, res, next);

      // Then
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass unknown errors to next()', async () => {
      // Given
      req.headers.authorization = 'Bearer some-token';
      const unknownError = new Error('Unknown error');
      verifyTokenUseCase.execute.mockRejectedValue(unknownError);

      // When
      await middleware(req, res, next);

      // Then
      expect(next).toHaveBeenCalledWith(unknownError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('with query param token', () => {
    it('should accept query param token in non-production', async () => {
      // Given
      config.NODE_ENV = 'development';

      req.query = { token: 'query-token' };
      verifyTokenUseCase.execute.mockResolvedValue({
        payload: {
          userId: 'user-123',
          email: 'test@example.com',
          role: 'STUDENT',
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'STUDENT',
        },
      });

      // When
      await middleware(req, res, next);

      // Then
      expect(verifyTokenUseCase.execute).toHaveBeenCalledWith('query-token');
      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should reject query param token in production', async () => {
      // Given
      config.NODE_ENV = 'production';

      req.query = { token: 'query-token' };

      // When
      await middleware(req, res, next);

      // Then
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No se proporcionó token de autenticación',
        code: 'TOKEN_MISSING',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});

describe('requireRole', () => {
  let req: ReturnType<typeof createMockRequest>;
  let res: ReturnType<typeof createMockResponse>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should call next when user has matching role', () => {
    // Given
    req.user = { id: 'user-1', email: 'test@test.com', role: 'ADMIN' };
    const middleware = requireRole('ADMIN');

    // When
    middleware(req, res, next);

    // Then
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject non-matching role with 403', () => {
    // Given
    req.user = { id: 'user-1', email: 'test@test.com', role: 'STUDENT' };
    const middleware = requireRole('ADMIN');

    // When
    middleware(req, res, next);

    // Then
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No tienes permisos para realizar esta acción',
      code: 'FORBIDDEN',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when user is not authenticated', () => {
    // Given
    req.user = undefined;
    const middleware = requireRole('ADMIN');

    // When
    middleware(req, res, next);

    // Then
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No autenticado',
      code: 'NOT_AUTHENTICATED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow role match when user has one of multiple allowed roles', () => {
    // Given
    req.user = { id: 'user-1', email: 'test@test.com', role: 'TEACHER' };
    const middleware = requireRole('ADMIN', 'TEACHER');

    // When
    middleware(req, res, next);

    // Then
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
