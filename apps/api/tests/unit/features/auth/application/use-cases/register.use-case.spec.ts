import { RegisterUseCase } from '@/features/auth/application/use-cases/register.use-case.js';
import { UserAlreadyExistsError } from '@/features/auth/domain/ports/user.repository.port.js';
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

describe('RegisterUseCase', () => {
  let userRepo: jest.Mocked<IUserRepository>;
  let hashingService: jest.Mocked<IHashingService>;
  let tokenService: jest.Mocked<ITokenService>;
  let useCase: RegisterUseCase;

  beforeEach(() => {
    userRepo = createMockUserRepository();
    hashingService = createMockHashingService();
    tokenService = createMockTokenService();
    useCase = new RegisterUseCase(userRepo, hashingService, tokenService);
  });

  describe('execute', () => {
    const validInput = {
      email: 'newuser@example.com',
      password: 'securePassword123',
      name: 'New User',
    };

    it('should register successfully, hash password, and generate token', async () => {
      // Given
      const createdUser = createMockUser({
        id: 'new-user-id',
        email: validInput.email,
        username: 'newuser',
        name: validInput.name,
        role: 'STUDENT',
        passwordHash: 'hashed_password',
      });
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByIdentifier.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(createdUser);

      // When
      const result = await useCase.execute(validInput);

      // Then
      expect(userRepo.findByEmail).toHaveBeenCalledWith(validInput.email);
      expect(hashingService.hash).toHaveBeenCalledWith(validInput.password);
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validInput.email,
          passwordHash: 'hashed_password',
          name: validInput.name,
          username: 'newuser',
          role: 'STUDENT',
          quota: 0,
          cohort: 'default',
        }),
      );
      expect(tokenService.generateToken).toHaveBeenCalledWith({
        userId: 'new-user-id',
        email: validInput.email,
        role: 'STUDENT',
      });
      expect(result).toEqual({
        user: expect.objectContaining({
          id: 'new-user-id',
          email: validInput.email,
          username: 'newuser',
          name: validInput.name,
          role: 'STUDENT',
        }),
        token: 'mock-jwt-token',
      });
    });

    it('should throw UserAlreadyExistsError when email already exists', async () => {
      // Given
      userRepo.findByEmail.mockResolvedValue(createMockUser({ email: validInput.email }));

      // When / Then
      await expect(useCase.execute(validInput)).rejects.toThrow(UserAlreadyExistsError);
      await expect(useCase.execute(validInput)).rejects.toThrow(
        `User with email ${validInput.email} already exists`,
      );

      expect(hashingService.hash).not.toHaveBeenCalled();
      expect(userRepo.create).not.toHaveBeenCalled();
    });

    it('should throw UserAlreadyExistsError when provided username already exists', async () => {
      // Given
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByIdentifier.mockResolvedValue(createMockUser({ username: 'takenusername' }));

      const inputWithTakenUsername = {
        ...validInput,
        username: 'takenusername',
      };

      // When / Then
      await expect(useCase.execute(inputWithTakenUsername)).rejects.toThrow(UserAlreadyExistsError);

      expect(hashingService.hash).not.toHaveBeenCalled();
      expect(userRepo.create).not.toHaveBeenCalled();
    });

    it('should return user without passwordHash', async () => {
      // Given
      const createdUser = createMockUser({
        email: validInput.email,
        username: 'newuser',
        passwordHash: 'hashed_password',
      });
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByIdentifier.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(createdUser);

      // When
      const result = await useCase.execute(validInput);

      // Then
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should return token on successful registration', async () => {
      // Given
      const createdUser = createMockUser({ email: validInput.email, username: 'newuser' });
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByIdentifier.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(createdUser);

      // When
      const result = await useCase.execute(validInput);

      // Then
      expect(result.token).toBe('mock-jwt-token');
    });

    it('should set default role to STUDENT', async () => {
      // Given
      const createdUser = createMockUser({ email: validInput.email, username: 'newuser' });
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByIdentifier.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(createdUser);

      // When
      await useCase.execute(validInput);

      // Then
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'STUDENT',
        }),
      );
    });

    it('should use provided username when given', async () => {
      // Given
      const createdUser = createMockUser({
        email: validInput.email,
        username: 'customuser',
      });
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByIdentifier.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(createdUser);

      // When
      await useCase.execute({ ...validInput, username: 'customuser' });

      // Then
      expect(userRepo.findByIdentifier).toHaveBeenCalledWith('customuser');
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'customuser',
        }),
      );
    });

    it('should generate unique username from email when not provided', async () => {
      // Given
      const createdUser = createMockUser({
        email: 'first.last@example.com',
        username: 'firstlast',
      });
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByIdentifier.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(createdUser);

      // When
      await useCase.execute({
        email: 'first.last@example.com',
        password: 'password',
        name: 'First Last',
      });

      // Then
      expect(userRepo.findByIdentifier).toHaveBeenCalledWith('firstlast');
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'firstlast',
        }),
      );
    });

    it('should generate unique username with counter when base is taken', async () => {
      // Given
      const createdUser = createMockUser({
        email: validInput.email,
        username: 'newuser1',
      });
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByIdentifier
        .mockResolvedValueOnce(createMockUser({ username: 'newuser' })) // base taken
        .mockResolvedValueOnce(null); // newuser1 is available
      userRepo.create.mockResolvedValue(createdUser);

      // When
      const result = await useCase.execute(validInput);

      // Then
      expect(userRepo.findByIdentifier).toHaveBeenNthCalledWith(1, 'newuser');
      expect(userRepo.findByIdentifier).toHaveBeenNthCalledWith(2, 'newuser1');
      expect(result.user.username).toBe('newuser1');
    });

    it('should include age when provided', async () => {
      // Given
      const createdUser = createMockUser({
        email: validInput.email,
        username: 'newuser',
        age: 20,
      });
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByIdentifier.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(createdUser);

      // When
      await useCase.execute({ ...validInput, age: 20 });

      // Then
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          age: 20,
        }),
      );
    });
  });
});
