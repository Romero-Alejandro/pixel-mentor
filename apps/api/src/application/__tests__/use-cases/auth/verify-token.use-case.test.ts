import jwt from 'jsonwebtoken';

import { VerifyTokenUseCase } from '@/application/use-cases/auth/verify-token.use-case';
import type { UserRepository } from '@/domain/ports/user-repository';
import type { User } from '@/domain/entities/user';

jest.mock('jsonwebtoken', () => {
  const mockError = class extends Error {
    constructor(message: string) {
      super(message);
    }
  };
  return {
    __esModule: true,
    default: {
      sign: jest.fn(),
      verify: jest.fn(),
    },
    sign: jest.fn(),
    verify: jest.fn(),
    JsonWebTokenError: mockError,
    TokenExpiredError: mockError,
  };
});
jest.mock('@/config/index.js', () => ({
  config: {
    JWT_SECRET: 'test-secret-key',
  },
}));
jest.mock('@/config/index.js', () => ({
  config: {
    JWT_SECRET: 'test-secret-key',
  },
}));

describe('VerifyTokenUseCase', () => {
  let useCase: VerifyTokenUseCase;
  let mockUserRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      create: jest.fn(),
      updateRole: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new VerifyTokenUseCase(mockUserRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute()', () => {
    const testSecret = 'test-secret-key';
    const testPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'STUDENT',
    };

    const mockUser: User = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'STUDENT',
      quota: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should verify valid token successfully', async () => {
      const token = 'valid-token';
      (jwt.verify as jest.Mock).mockReturnValueOnce(testPayload);
      mockUserRepo.findById.mockResolvedValueOnce(mockUser);

      const result = await useCase.execute(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, testSecret);
      expect(mockUserRepo.findById).toHaveBeenCalledWith(testPayload.userId);
      expect(result).toEqual(
        expect.objectContaining({
          userId: testPayload.userId,
          email: testPayload.email,
          role: testPayload.role,
        }),
      );
    });

    it('should throw error for invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('invalid token');
      });

      const token = 'invalid-token';

      await expect(useCase.execute(token)).rejects.toThrow();
    });

    it('should throw error for expired token', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('jwt expired');
      });

      const token = 'expired-token';

      await expect(useCase.execute(token)).rejects.toThrow();
    });

    it('should throw error if user not found', async () => {
      const token = 'valid-token';
      (jwt.verify as jest.Mock).mockReturnValueOnce(testPayload);
      mockUserRepo.findById.mockResolvedValueOnce(null);

      await expect(useCase.execute(token)).rejects.toThrow();
    });

    it('should extract userId from token payload', async () => {
      const token = 'valid-token';
      (jwt.verify as jest.Mock).mockReturnValueOnce(testPayload);
      mockUserRepo.findById.mockResolvedValueOnce(mockUser);

      const result = await useCase.execute(token);

      expect(result.userId).toBe('user-123');
    });

    it('should extract role from token payload', async () => {
      const token = 'valid-token';
      (jwt.verify as jest.Mock).mockReturnValueOnce(testPayload);
      mockUserRepo.findById.mockResolvedValueOnce(mockUser);

      const result = await useCase.execute(token);

      expect(result.role).toBe('STUDENT');
    });
  });
});
