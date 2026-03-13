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
      email: 'test@example.com',
      password: 'password123',
    };

    const userWithPassword: User = {
      id: 'user-id-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'STUDENT',
      quota: 0,
      passwordHash: 'hashedPassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should login successfully with valid credentials', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValueOnce(userWithPassword);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce('jwt-token');

      const result = await useCase.execute(validInput);

      expect(mockUserRepo.findByEmailWithPassword).toHaveBeenCalledWith(validInput.email);
      expect(argon2.verify).toHaveBeenCalledWith('hashedPassword', validInput.password);
      expect(result).toHaveProperty('token', 'jwt-token');
      expect(result.user).toEqual(
        expect.objectContaining({
          email: validInput.email,
          name: 'Test User',
          role: 'STUDENT',
        }),
      );
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw error if user not found', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValueOnce(null);

      await expect(useCase.execute(validInput)).rejects.toThrow('Invalid credentials');
      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('should throw error if password is incorrect', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValueOnce(userWithPassword);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

      await expect(useCase.execute(validInput)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if user has no password hash', async () => {
      const userWithoutPassword: User = {
        ...userWithPassword,
        passwordHash: undefined,
      };
      mockUserRepo.findByEmailWithPassword.mockResolvedValueOnce(userWithoutPassword);

      await expect(useCase.execute(validInput)).rejects.toThrow('Invalid credentials');
    });

    it('should generate JWT with correct payload', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValueOnce(userWithPassword);
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
      mockUserRepo.findByEmailWithPassword.mockResolvedValueOnce(userWithPassword);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce('jwt-token');

      const result = await useCase.execute(validInput);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).toHaveProperty('email', 'test@example.com');
    });
  });
});
