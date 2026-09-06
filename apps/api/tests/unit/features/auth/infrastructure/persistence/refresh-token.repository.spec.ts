import { PrismaRefreshTokenRepository } from '@/features/auth/infrastructure/persistence/refresh-token.repository.js';

// Mock the prisma client
jest.mock('@/database/client.js', () => ({
  prisma: {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const { prisma } = require('@/database/client.js');

describe('PrismaRefreshTokenRepository', () => {
  let repository: PrismaRefreshTokenRepository;

  beforeEach(() => {
    repository = new PrismaRefreshTokenRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should store a token in the database', async () => {
      // Given
      const tokenData = {
        userId: 'user-123',
        tokenHash: 'hashed-token',
        expiresAt: new Date('2026-01-01'),
      };
      prisma.refreshToken.create.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-123',
        tokenHash: 'hashed-token',
        expiresAt: new Date('2026-01-01'),
        revoked: false,
        revokedAt: null,
        createdAt: new Date(),
      });

      // When
      await repository.create(tokenData);

      // Then
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          tokenHash: 'hashed-token',
          expiresAt: new Date('2026-01-01'),
        },
      });
    });
  });

  describe('findByTokenHash', () => {
    it('should find a token by hash', async () => {
      // Given
      const mockRecord = {
        id: 'rt-1',
        userId: 'user-123',
        tokenHash: 'hashed-token',
        expiresAt: new Date('2026-01-01'),
        revoked: false,
        revokedAt: null,
        createdAt: new Date(),
      };
      prisma.refreshToken.findUnique.mockResolvedValue(mockRecord);

      // When
      const result = await repository.findByTokenHash('hashed-token');

      // Then
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: 'hashed-token' },
      });
      expect(result).toBeDefined();
      expect(result?.userId).toBe('user-123');
    });

    it('should return null when token is not found', async () => {
      // Given
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      // When
      const result = await repository.findByTokenHash('nonexistent-hash');

      // Then
      expect(result).toBeNull();
    });
  });

  describe('deleteByUserId', () => {
    it('should delete all tokens for a user', async () => {
      // Given
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      // When
      await repository.deleteByUserId('user-123');

      // Then
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });
});
