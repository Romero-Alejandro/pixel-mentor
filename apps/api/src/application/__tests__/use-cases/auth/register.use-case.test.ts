import { RegisterUseCase } from '@/application/use-cases/auth/register.use-case';
import type { UserRepository } from '@/domain/ports/user-repository';
import type { User, UserRole } from '@/domain/entities/user';

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

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
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
    useCase = new RegisterUseCase(mockUserRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute()', () => {
    const validInput = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'STUDENT' as UserRole,
    };

    const createdUser: User = {
      id: 'user-id-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'STUDENT',
      quota: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should register a new user successfully', async () => {
      mockUserRepo.findByEmail.mockResolvedValueOnce(null);
      (argon2.hash as jest.Mock).mockResolvedValueOnce('hashedPassword');
      mockUserRepo.create.mockResolvedValueOnce(createdUser);
      (jwt.sign as jest.Mock).mockReturnValueOnce('jwt-token');

      const result = await useCase.execute(validInput);

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(validInput.email);
      expect(argon2.hash).toHaveBeenCalledWith(validInput.password);
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        email: validInput.email,
        passwordHash: 'hashedPassword',
        name: validInput.name,
        role: validInput.role,
        age: undefined,
        quota: 0,
      });
      expect(result).toHaveProperty('token', 'jwt-token');
      expect(result.user).toEqual(
        expect.objectContaining({
          email: validInput.email,
          name: validInput.name,
          role: validInput.role,
        }),
      );
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw error if email already exists', async () => {
      mockUserRepo.findByEmail.mockResolvedValueOnce(createdUser);

      await expect(useCase.execute(validInput)).rejects.toThrow('User already exists');
      expect(mockUserRepo.create).not.toHaveBeenCalled();
    });

    it('should create user with age when provided', async () => {
      mockUserRepo.findByEmail.mockResolvedValueOnce(null);
      (argon2.hash as jest.Mock).mockResolvedValueOnce('hashedPassword');
      mockUserRepo.create.mockResolvedValueOnce({ ...createdUser, age: 15 });
      (jwt.sign as jest.Mock).mockReturnValueOnce('jwt-token');

      const inputWithAge = { ...validInput, age: 15 };
      const result = await useCase.execute(inputWithAge);

      expect(mockUserRepo.create).toHaveBeenCalledWith(expect.objectContaining({ age: 15 }));
      expect(result.user).toHaveProperty('age', 15);
    });

    it('should create user with TEACHER role', async () => {
      mockUserRepo.findByEmail.mockResolvedValueOnce(null);
      (argon2.hash as jest.Mock).mockResolvedValueOnce('hashedPassword');
      mockUserRepo.create.mockResolvedValueOnce({ ...createdUser, role: 'TEACHER' as UserRole });
      (jwt.sign as jest.Mock).mockReturnValueOnce('jwt-token');

      const inputWithRole = { ...validInput, role: 'TEACHER' as UserRole };
      const result = await useCase.execute(inputWithRole);

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'TEACHER' }),
      );
      expect(result.user.role).toBe('TEACHER');
    });

    it('should generate JWT with correct payload', async () => {
      mockUserRepo.findByEmail.mockResolvedValueOnce(null);
      (argon2.hash as jest.Mock).mockResolvedValueOnce('hashedPassword');
      mockUserRepo.create.mockResolvedValueOnce(createdUser);
      (jwt.sign as jest.Mock).mockReturnValueOnce('jwt-token');

      await useCase.execute(validInput);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: createdUser.id,
          email: createdUser.email,
          role: createdUser.role,
        },
        'test-secret-key',
        { expiresIn: '7d' },
      );
    });
  });
});
