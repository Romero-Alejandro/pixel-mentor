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
import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { VerifyTokenUseCase } from '@/features/auth/application/use-cases/verify-token.use-case.js';
import { TokenInvalidError, TokenExpiredError } from '@/features/auth/domain/auth.errors.js';
import type { User } from '@/features/auth/domain/entities/user.entity.js';

const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  name: 'Test User',
  role: 'STUDENT',
  age: undefined,
  quota: 0,
  cohort: 'default',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockUserRepository = (): jest.Mocked<IUserRepository> => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  findByEmailWithPassword: jest.fn(),
  findByIdentifier: jest.fn(),
  findByIdentifierWithPassword: jest.fn(),
  create: jest.fn(),
  updateRole: jest.fn(),
  updateQuota: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
});

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
  let userRepo: jest.Mocked<IUserRepository>;
  let verifyTokenUseCase: jest.Mocked<VerifyTokenUseCase>;
  let middleware: ReturnType<typeof authMiddleware>;
  let req: ReturnType<typeof createMockRequest>;
  let res: ReturnType<typeof createMockResponse>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    userRepo = createMockUserRepository();
    verifyTokenUseCase = createMockVerifyTokenUseCase();
    middleware = authMiddleware(userRepo, verifyTokenUseCase);
    req = createMockRequest();
    res = createMockResponse();
    next = jest.fn();
  });

  describe('with Bearer token', () => {
    it('should authenticate user with valid Bearer token', async () => {
      // Given
      const mockUser = createMockUser({ id: 'user-123', role: 'ADMIN' });
      req.headers.authorization = 'Bearer valid-token';
      verifyTokenUseCase.execute.mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      });
      userRepo.findById.mockResolvedValue(mockUser);

      // When
      await middleware(req, res, next);

      // Then
      expect(verifyTokenUseCase.execute).toHaveBeenCalledWith('valid-token');
      expect(userRepo.findById).toHaveBeenCalledWith('user-123');
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
      verifyTokenUseCase.execute.mockResolvedValue({
        userId: 'nonexistent',
        email: 'test@example.com',
        role: 'STUDENT',
      });
      userRepo.findById.mockResolvedValue(null);

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
      req.headers.authorization = 'Bearer valid-token';
      const unknownError = new Error('Something went wrong');
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

      const mockUser = createMockUser();
      req.query = { token: 'query-token' };
      verifyTokenUseCase.execute.mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'STUDENT',
      });
      userRepo.findById.mockResolvedValue(mockUser);

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
      expect(verifyTokenUseCase.execute).not.toHaveBeenCalled();

      // Reset
      config.NODE_ENV = 'development';
    });
  });
});

describe('requireRole', () => {
  let req: Partial<AuthRequest> & { headers: Record<string, string | undefined> };
  let res: ReturnType<typeof createMockResponse>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    req = { headers: {}, user: undefined };
    res = createMockResponse();
    next = jest.fn();
  });

  it('should call next when user has matching role', () => {
    // Given
    req.user = { id: 'user-1', email: 'test@example.com', role: 'ADMIN' };
    const middleware = requireRole('ADMIN', 'TEACHER');

    // When
    middleware(req as AuthRequest, res, next);

    // Then
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject non-matching role with 403', () => {
    // Given
    req.user = { id: 'user-1', email: 'test@example.com', role: 'STUDENT' };
    const middleware = requireRole('ADMIN', 'TEACHER');

    // When
    middleware(req as AuthRequest, res, next);

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
    middleware(req as AuthRequest, res, next);

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
    req.user = { id: 'user-1', email: 'test@example.com', role: 'TEACHER' };
    const middleware = requireRole('STUDENT', 'TEACHER', 'ADMIN');

    // When
    middleware(req as AuthRequest, res, next);

    // Then
    expect(next).toHaveBeenCalled();
  });
});
