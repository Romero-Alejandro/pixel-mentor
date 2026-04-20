import { ResolveUserByEmailUseCase } from '../resolve-user-by-email.use-case';
import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { User } from '@/features/auth/domain/entities/user.entity.js';

describe('ResolveUserByEmailUseCase', () => {
  let useCase: ResolveUserByEmailUseCase;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepo = {
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
    };
    useCase = new ResolveUserByEmailUseCase(mockUserRepo);
  });

  describe('execute', () => {
    it('should return user data when email exists', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'STUDENT',
        quota: 100,
        cohort: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      const result = await useCase.execute({ email: 'test@example.com' });

      expect(result).toEqual({
        uuid: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return null when email does not exist', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      const result = await useCase.execute({ email: 'nonexistent@example.com' });

      expect(result).toBeNull();
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
    });

    it('should perform case-insensitive email lookup', async () => {
      const mockUser: User = {
        id: 'user-456',
        email: 'Test.User@example.com',
        name: 'Test User',
        role: 'TEACHER',
        quota: 1000,
        cohort: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      const result = await useCase.execute({ email: 'TEST.USER@example.com' });

      expect(result).toEqual({
        uuid: 'user-456',
        email: 'Test.User@example.com',
        name: 'Test User',
      });
    });
  });
});
