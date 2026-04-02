import type { CreateUserInput } from '@/features/auth/application/services/admin-user.service.js';
import { AdminUserService } from '@/features/auth/application/services/admin-user.service.js';
import type { User, UserRole } from '@/features/auth/domain/entities/user.entity.js';
import type { IUserRepository as UserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import { UserAlreadyExistsError, UserNotFoundError } from '@/features/auth/domain/ports/user.repository.port.js';
import { ForbiddenError } from '@/features/auth/domain/auth.errors.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';

// Jest globals are available automatically

// Mock types
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

const createMockUserRepository = (): jest.Mocked<UserRepository> => {
  const mockRepo: jest.Mocked<UserRepository> = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findByIdentifier: jest.fn(),
    findByIdentifierWithPassword: jest.fn(),
    create: jest.fn(),
    updateRole: jest.fn(),
    delete: jest.fn(),
    findAll: jest.fn(),
  };

  mockRepo.findByEmail.mockResolvedValue(null);
  mockRepo.findById.mockResolvedValue(null);
  mockRepo.findByIdentifier.mockResolvedValue(null);
  mockRepo.create.mockImplementation((data: unknown) =>
    Promise.resolve(
      createMockUser({
        id: crypto.randomUUID(),
        email: (data as { email: string }).email,
        username: (data as { username?: string }).username,
        name: (data as { name: string }).name,
        role: (data as { role: UserRole }).role,
        age: (data as { age?: number }).age,
        quota: (data as { quota?: number }).quota ?? 0,
        cohort: (data as { cohort?: string }).cohort ?? 'default',
      }),
    ),
  );
  mockRepo.updateRole.mockImplementation((id: string, role: UserRole) =>
    Promise.resolve(createMockUser({ id, role })),
  );
  mockRepo.delete.mockResolvedValue(undefined);
  mockRepo.findAll.mockResolvedValue({
    users: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });

  return mockRepo;
};

// Mock hashing service
const createMockHashingService = (): jest.Mocked<IHashingService> => ({
  hash: jest.fn().mockImplementation((_password: string) => Promise.resolve(`hashed_${_password}`)),
  compare: jest
    .fn()
    .mockImplementation((_password: string, _hash: string) => Promise.resolve(true)),
});

describe('AdminUserService', () => {
  let userRepository: jest.Mocked<UserRepository>;
  let hashingService: jest.Mocked<IHashingService>;
  let service: AdminUserService;

  beforeEach(() => {
    userRepository = createMockUserRepository();
    hashingService = createMockHashingService();
    service = new AdminUserService(userRepository, hashingService);
  });

  describe('createUser', () => {
    const validInput: CreateUserInput = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
      role: 'TEACHER',
    };

    it('should create a user successfully with all fields including username', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(
        createMockUser({
          email: validInput.email,
          username: 'newuser',
          name: validInput.name,
          role: validInput.role,
          quota: 0,
          cohort: 'default',
        }),
      );

      const result = await service.createUser({
        ...validInput,
        username: 'newuser',
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith(validInput.email);
      expect(userRepository.findByIdentifier).toHaveBeenCalledWith('newuser');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validInput.email,
          username: 'newuser',
          name: validInput.name,
          role: validInput.role,
          passwordHash: expect.any(String),
          quota: 0,
          cohort: 'default',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: validInput.email,
          username: 'newuser',
          name: validInput.name,
          role: validInput.role,
          quota: 0,
          cohort: 'default',
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should create a user successfully without username (generates unique username)', async () => {
      const inputWithoutUsername: CreateUserInput = {
        email: 'generated@example.com',
        password: 'password123',
        name: 'Generated User',
        role: 'STUDENT',
      };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValue(
        createMockUser({
          email: inputWithoutUsername.email,
          username: 'generated',
          name: inputWithoutUsername.name,
          role: inputWithoutUsername.role,
        }),
      );

      const result = await service.createUser(inputWithoutUsername);

      expect(userRepository.findByIdentifier).toHaveBeenCalledWith('generated');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: inputWithoutUsername.email,
          username: 'generated',
        }),
      );
      expect(result.username).toBe('generated');
    });

    it('should generate unique username with counter if base is taken', async () => {
      const input: CreateUserInput = {
        email: 'taken@example.com',
        password: 'password123',
        name: 'Taken User',
        role: 'STUDENT',
      };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier
        .mockResolvedValueOnce(createMockUser({ username: 'taken' }))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      userRepository.create.mockResolvedValue(
        createMockUser({
          email: input.email,
          username: 'taken1',
          name: input.name,
          role: input.role,
        }),
      );

      const result = await service.createUser(input);

      expect(userRepository.findByIdentifier).toHaveBeenNthCalledWith(1, 'taken');
      expect(userRepository.findByIdentifier).toHaveBeenNthCalledWith(2, 'taken1');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'taken1',
        }),
      );
      expect(result.username).toBe('taken1');
    });

    it('should throw UserAlreadyExistsError when email already exists', async () => {
      userRepository.findByEmail.mockResolvedValue(createMockUser({ email: validInput.email }));

      await expect(service.createUser(validInput)).rejects.toThrow(UserAlreadyExistsError);
      await expect(service.createUser(validInput)).rejects.toThrow(
        `User with email ${validInput.email} already exists`,
      );
    });

    it('should throw UserAlreadyExistsError when username already exists', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier.mockResolvedValue(
        createMockUser({ username: 'takenusername' }),
      );

      const inputWithTakenUsername: CreateUserInput = {
        ...validInput,
        username: 'takenusername',
      };

      await expect(service.createUser(inputWithTakenUsername)).rejects.toThrow(
        UserAlreadyExistsError,
      );
    });

    it('should create ADMIN user with correct role', async () => {
      const adminInput: CreateUserInput = {
        email: 'admin@example.com',
        password: 'securepass',
        name: 'Super Admin',
        role: 'ADMIN',
      };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(
        createMockUser({ email: adminInput.email, role: adminInput.role }),
      );

      const result = await service.createUser(adminInput);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ADMIN',
        }),
      );
      expect(result.role).toBe('ADMIN');
    });

    it('should hash password using hashing service', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier.mockResolvedValue(null);

      const hashSpy = jest.spyOn(hashingService, 'hash');

      userRepository.create.mockResolvedValue(createMockUser({ email: validInput.email }));

      await service.createUser(validInput);

      expect(hashSpy).toHaveBeenCalledWith(validInput.password);
      hashSpy.mockRestore();
    });
  });

  describe('listUsers', () => {
    it('should return all users with default options', async () => {
      const mockUsers = [
        createMockUser({ id: 'user-1', email: 'user1@example.com' }),
        createMockUser({ id: 'user-2', email: 'user2@example.com' }),
      ];
      userRepository.findAll.mockResolvedValue({
        users: mockUsers,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const result = await service.listUsers({});

      expect(userRepository.findAll).toHaveBeenCalledWith({});
      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter users by role', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' });
      userRepository.findAll.mockResolvedValue({
        users: [adminUser],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const result = await service.listUsers({ role: 'ADMIN' });

      expect(userRepository.findAll).toHaveBeenCalledWith({ role: 'ADMIN' });
      expect(result.users[0].role).toBe('ADMIN');
    });

    it('should support pagination options', async () => {
      userRepository.findAll.mockResolvedValue({
        users: [],
        total: 50,
        page: 2,
        limit: 20,
        totalPages: 3,
      });

      await service.listUsers({ page: 2, limit: 20 });

      expect(userRepository.findAll).toHaveBeenCalledWith({ page: 2, limit: 20 });
    });
  });

  describe('getUser', () => {
    it('should return a user by ID', async () => {
      const mockUser = createMockUser({ id: 'user-123', email: 'test@example.com' });
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.getUser('user-123');

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.getUser('nonexistent-id')).rejects.toThrow(UserNotFoundError);
      await expect(service.getUser('nonexistent-id')).rejects.toThrow(
        'User not found: nonexistent-id',
      );
    });

    it('should sanitize user by removing passwordHash from returned object', async () => {
      const userWithPassword = createMockUser({
        passwordHash: 'hashed_password_123',
      });
      userRepository.findById.mockResolvedValue(userWithPassword);

      const result = await service.getUser('user-123');

      expect(result).not.toHaveProperty('passwordHash');
      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
    });
  });

  describe('updateUserRole', () => {
    const adminId = 'admin-123';
    const targetUserId = 'target-123';

    it('should update user role successfully', async () => {
      const targetUser = createMockUser({ id: targetUserId, role: 'STUDENT' });
      userRepository.findById.mockResolvedValue(targetUser);
      userRepository.updateRole.mockResolvedValue(
        createMockUser({ id: targetUserId, role: 'TEACHER' }),
      );

      const result = await service.updateUserRole(targetUserId, 'TEACHER', adminId);

      expect(userRepository.findById).toHaveBeenCalledWith(targetUserId);
      expect(userRepository.updateRole).toHaveBeenCalledWith(targetUserId, 'TEACHER');
      expect(result.role).toBe('TEACHER');
    });

    it('should throw ForbiddenError when trying to change own role', async () => {
      await expect(service.updateUserRole(adminId, 'TEACHER', adminId)).rejects.toThrow(
        ForbiddenError,
      );
      await expect(service.updateUserRole(adminId, 'TEACHER', adminId)).rejects.toThrow(
        'No puedes cambiar tu propio rol',
      );
    });

    it('should throw UserNotFoundError when target user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.updateUserRole('nonexistent', 'ADMIN', adminId)).rejects.toThrow(
        UserNotFoundError,
      );
      await expect(service.updateUserRole('nonexistent', 'ADMIN', adminId)).rejects.toThrow(
        'User not found: nonexistent',
      );
    });

    it('should update role multiple times consecutively', async () => {
      const targetId = 'multi-update-user';
      userRepository.findById.mockResolvedValue(createMockUser({ id: targetId }));
      userRepository.updateRole.mockResolvedValue(createMockUser({ id: targetId, role: 'ADMIN' }));

      await service.updateUserRole(targetId, 'TEACHER', 'admin-123');
      await service.updateUserRole(targetId, 'ADMIN', 'admin-123');

      expect(userRepository.updateRole).toHaveBeenCalledTimes(2);
      expect(userRepository.updateRole).toHaveBeenNthCalledWith(1, targetId, 'TEACHER');
      expect(userRepository.updateRole).toHaveBeenNthCalledWith(2, targetId, 'ADMIN');
    });
  });

  describe('deleteUser', () => {
    const adminId = 'admin-123';
    const targetUserId = 'target-123';

    it('should delete user successfully', async () => {
      const targetUser = createMockUser({ id: targetUserId });
      userRepository.findById.mockResolvedValue(targetUser);
      userRepository.delete.mockResolvedValue(undefined);

      await service.deleteUser(targetUserId, adminId);

      expect(userRepository.findById).toHaveBeenCalledWith(targetUserId);
      expect(userRepository.delete).toHaveBeenCalledWith(targetUserId);
    });

    it('should throw ForbiddenError when trying to delete self', async () => {
      await expect(service.deleteUser(adminId, adminId)).rejects.toThrow(ForbiddenError);
      await expect(service.deleteUser(adminId, adminId)).rejects.toThrow(
        'No puedes eliminar tu propia cuenta',
      );
    });

    it('should throw UserNotFoundError when target user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.deleteUser('nonexistent', adminId)).rejects.toThrow(UserNotFoundError);
      await expect(service.deleteUser('nonexistent', adminId)).rejects.toThrow(
        'User not found: nonexistent',
      );
    });

    it('should proceed with delete after verifying user exists', async () => {
      const targetUser = createMockUser({ id: 'target-123' });
      userRepository.findById.mockResolvedValue(targetUser);
      userRepository.delete.mockResolvedValue(undefined);

      await service.deleteUser('target-123', 'admin-123');

      expect(userRepository.delete).toHaveBeenCalledWith('target-123');
    });
  });

  describe('createUser (additional edge cases)', () => {
    it('should handle age field for student role', async () => {
      const studentInput: CreateUserInput = {
        email: 'student@example.com',
        password: 'password123',
        name: 'Student User',
        role: 'STUDENT',
        age: 20,
      };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(
        createMockUser({
          email: studentInput.email,
          age: studentInput.age,
          role: studentInput.role,
        }),
      );

      await service.createUser(studentInput);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          age: 20,
          role: 'STUDENT',
        }),
      );
    });

    it('should handle optional username field as undefined', async () => {
      const input: CreateUserInput = {
        email: 'nousername@example.com',
        password: 'password123',
        name: 'No Username User',
        role: 'TEACHER',
        username: undefined,
      };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(
        createMockUser({
          email: input.email,
          username: 'nousername',
          role: input.role,
        }),
      );

      await service.createUser(input);

      expect(userRepository.findByIdentifier).toHaveBeenCalledWith('nousername');
    });

    it('should accept all valid user roles', async () => {
      const roles: UserRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier.mockResolvedValue(null);

      for (const role of roles) {
        userRepository.create.mockResolvedValue(createMockUser({ role }));
        const input: CreateUserInput = {
          email: `user-${role.toLowerCase()}@example.com`,
          password: 'password123',
          name: `User ${role}`,
          role,
        };

        const result = await service.createUser(input);
        expect(result.role).toBe(role);
      }
    });

    it('should handle special characters in email for username generation', async () => {
      const input: CreateUserInput = {
        email: 'first.last+tag@example.com',
        password: 'password123',
        name: 'Special Char User',
        role: 'STUDENT',
      };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(
        createMockUser({
          email: input.email,
          username: 'firstlasttag', // Generated: non-alphanumeric chars removed, plus sign also removed
        }),
      );

      await service.createUser(input);

      expect(userRepository.findByIdentifier).toHaveBeenCalledWith('firstlasttag');
    });

    it('should set default quota to 0 and cohort to default', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByIdentifier.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(createMockUser({ email: 'new@example.com' }));

      await service.createUser({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        role: 'STUDENT',
      });

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quota: 0,
          cohort: 'default',
        }),
      );
    });
  });
});
