import { LoginUseCase } from '@/application/use-cases/auth/login.use-case';
import type { UserRepository } from '@/domain/ports/user-repository';
import type { User } from '@/domain/entities/user';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));
jest.mock('@/config/index.js', () => ({
  config: {
    JWT_SECRET: 'test-secret-key',
  },
}));

import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let mockUserRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      findByIdentifier: jest.fn(),
      findByIdentifierWithPassword: jest.fn(),
      create: jest.fn(),
      updateRole: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new LoginUseCase(mockUserRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute()', () => {
    const validInput = {
      identifier: 'test@example.com',
      password: 'password123',
    };

    const userWithPassword: User = {
      id: 'user-id-123',
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      role: 'STUDENT',
      quota: 0,
      passwordHash: 'hashedPassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should login successfully with email identifier', async () => {
      mockUserRepo.findByIdentifierWithPassword.mockResolvedValueOnce(userWithPassword);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce('jwt-token');

      const result = await useCase.execute(validInput);

      expect(mockUserRepo.findByIdentifierWithPassword).toHaveBeenCalledWith(validInput.identifier);
      expect(argon2.verify).toHaveBeenCalledWith('hashedPassword', validInput.password);
      expect(result).toHaveProperty('token', 'jwt-token');
      expect(result.user).toEqual(
        expect.objectContaining({
          email: validInput.identifier,
          name: 'Test User',
          role: 'STUDENT',
        }),
      );
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should login successfully with username identifier', async () => {
      const usernameInput = { identifier: 'testuser', password: 'password123' };
      mockUserRepo.findByIdentifierWithPassword.mockResolvedValueOnce(userWithPassword);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce('jwt-token');

      const result = await useCase.execute(usernameInput);

      expect(mockUserRepo.findByIdentifierWithPassword).toHaveBeenCalledWith('testuser');
      expect(result).toHaveProperty('token', 'jwt-token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw InvalidCredentialsError if user not found', async () => {
      mockUserRepo.findByIdentifierWithPassword.mockResolvedValueOnce(null);

      await expect(useCase.execute(validInput)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        httpStatus: 401,
      });
      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('should throw InvalidCredentialsError if password is incorrect', async () => {
      mockUserRepo.findByIdentifierWithPassword.mockResolvedValueOnce(userWithPassword);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

      await expect(useCase.execute(validInput)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        httpStatus: 401,
      });
    });

    it('should throw InvalidCredentialsError if user has no password hash', async () => {
      const userWithoutPassword: User = {
        ...userWithPassword,
        passwordHash: undefined,
      };
      mockUserRepo.findByIdentifierWithPassword.mockResolvedValueOnce(userWithoutPassword);

      await expect(useCase.execute(validInput)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        httpStatus: 401,
      });
    });

    it('should generate JWT with correct payload', async () => {
      mockUserRepo.findByIdentifierWithPassword.mockResolvedValueOnce(userWithPassword);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce('jwt-token');

      await useCase.execute(validInput);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: userWithPassword.id,
          email: userWithPassword.email,
          role: userWithPassword.role,
        },
        'test-secret-key',
        { expiresIn: '7d' },
      );
    });

    it('should return user without password hash', async () => {
      mockUserRepo.findByIdentifierWithPassword.mockResolvedValueOnce(userWithPassword);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce('jwt-token');

      const result = await useCase.execute(validInput);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).toHaveProperty('email', 'test@example.com');
    });
  });
});
