import { LoginUseCase } from '@/features/auth/application/use-cases/login.use-case.js';
import { InvalidCredentialsError } from '@/features/auth/domain/auth.errors.js';
import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';
import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
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

const createMockHashingService = (): jest.Mocked<IHashingService> => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
});

const createMockTokenService = (): jest.Mocked<ITokenService> => ({
  generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
  verifyToken: jest.fn(),
});

describe('LoginUseCase', () => {
  let userRepo: jest.Mocked<IUserRepository>;
  let hashingService: jest.Mocked<IHashingService>;
  let tokenService: jest.Mocked<ITokenService>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    userRepo = createMockUserRepository();
    hashingService = createMockHashingService();
    tokenService = createMockTokenService();
    useCase = new LoginUseCase(userRepo, hashingService, tokenService);
  });

  describe('execute', () => {
    it('should login successfully with email', async () => {
      // Given
      const mockUser = createMockUser({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
      });
      userRepo.findByIdentifierWithPassword.mockResolvedValue(mockUser);
      hashingService.compare.mockResolvedValue(true);

      // When
      const result = await useCase.execute({
        identifier: 'test@example.com',
        password: 'correct-password',
      });

      // Then
      expect(userRepo.findByIdentifierWithPassword).toHaveBeenCalledWith('test@example.com');
      expect(hashingService.compare).toHaveBeenCalledWith('correct-password', 'hashed_pw');
      expect(tokenService.generateToken).toHaveBeenCalledWith({
        userId: 'user-1',
        email: 'test@example.com',
        role: 'STUDENT',
      });
      expect(result).toEqual({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          role: 'STUDENT',
          age: undefined,
          quota: 0,
          cohort: 'default',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        token: 'mock-jwt-token',
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should login successfully with username', async () => {
      // Given
      const mockUser = createMockUser({
        id: 'user-2',
        username: 'myusername',
        passwordHash: 'hashed_pw',
      });
      userRepo.findByIdentifierWithPassword.mockResolvedValue(mockUser);

      // When
      const result = await useCase.execute({
        identifier: 'myusername',
        password: 'correct-password',
      });

      // Then
      expect(userRepo.findByIdentifierWithPassword).toHaveBeenCalledWith('myusername');
      expect(result.user.username).toBe('myusername');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw InvalidCredentialsError when user is not found', async () => {
      // Given
      userRepo.findByIdentifierWithPassword.mockResolvedValue(null);

      // When / Then
      await expect(useCase.execute({ identifier: 'nonexistent', password: 'any' })).rejects.toThrow(
        InvalidCredentialsError,
      );

      expect(hashingService.compare).not.toHaveBeenCalled();
      expect(tokenService.generateToken).not.toHaveBeenCalled();
    });

    it('should throw InvalidCredentialsError when user has no passwordHash', async () => {
      // Given
      const mockUser = createMockUser({ passwordHash: undefined });
      userRepo.findByIdentifierWithPassword.mockResolvedValue(mockUser);

      // When / Then
      await expect(
        useCase.execute({ identifier: 'test@example.com', password: 'any' }),
      ).rejects.toThrow(InvalidCredentialsError);

      expect(hashingService.compare).not.toHaveBeenCalled();
    });

    it('should throw InvalidCredentialsError when password does not match', async () => {
      // Given
      const mockUser = createMockUser({ passwordHash: 'hashed_pw' });
      userRepo.findByIdentifierWithPassword.mockResolvedValue(mockUser);
      hashingService.compare.mockResolvedValue(false);

      // When / Then
      await expect(
        useCase.execute({ identifier: 'test@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(InvalidCredentialsError);

      expect(tokenService.generateToken).not.toHaveBeenCalled();
    });

    it('should return user without passwordHash', async () => {
      // Given
      const mockUser = createMockUser({ passwordHash: 'secret_hash' });
      userRepo.findByIdentifierWithPassword.mockResolvedValue(mockUser);

      // When
      const result = await useCase.execute({
        identifier: 'test@example.com',
        password: 'password',
      });

      // Then
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should return token on successful login', async () => {
      // Given
      const mockUser = createMockUser({ passwordHash: 'hashed_pw' });
      userRepo.findByIdentifierWithPassword.mockResolvedValue(mockUser);

      // When
      const result = await useCase.execute({
        identifier: 'test@example.com',
        password: 'password',
      });

      // Then
      expect(result.token).toBe('mock-jwt-token');
    });
  });
});
