import { PrismaRefreshTokenRepository } from '@/features/auth/infrastructure/persistence/refresh-token.repository.js';
import { createHash } from 'node:crypto';

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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require('@/database/client.js');

describe('PrismaRefreshTokenRepository', () => {
  let repository: PrismaRefreshTokenRepository;

  beforeEach(() => {
    repository = new PrismaRefreshTokenRepository();
    jest.clearAllMocks();
  });

  const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

  describe('create', () => {
    it('should store a hashed token in the database', async () => {
      // Given
      const userId = 'user-123';
      const token = 'raw-refresh-token';
      const expiresAt = new Date('2026-01-01');
      const expectedHash = hashToken(token);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      // When
      await repository.create(userId, token, expiresAt);

      // Then
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId,
          tokenHash: expectedHash,
          expiresAt,
        },
      });
    });
  });

  describe('findByToken', () => {
    it('should find a token by hashing and looking up', async () => {
      // Given
      const token = 'raw-refresh-token';
      const expectedHash = hashToken(token);
      const mockRecord = {
        id: 'rt-1',
        userId: 'user-123',
        expiresAt: new Date('2026-01-01'),
        revoked: false,
      };
      prisma.refreshToken.findUnique.mockResolvedValue(mockRecord);

      // When
      const result = await repository.findByToken(token);

      // Then
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: expectedHash },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          revoked: true,
        },
      });
      expect(result).toEqual(mockRecord);
    });

    it('should return null when token is not found', async () => {
      // Given
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      // When
      const result = await repository.findByToken('nonexistent-token');

      // Then
      expect(result).toBeNull();
    });
  });

  describe('revoke', () => {
    it('should mark a token as revoked with revokedAt timestamp', async () => {
      // Given
      const token = 'raw-refresh-token';
      const expectedHash = hashToken(token);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      // When
      await repository.revoke(token);

      // Then
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expectedHash },
        data: {
          revoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all non-revoked tokens for a user', async () => {
      // Given
      const userId = 'user-123';
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      // When
      await repository.revokeAllForUser(userId);

      // Then
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId, revoked: false },
        data: {
          revoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired tokens and old revoked tokens', async () => {
      // Given
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      // When
      const result = await repository.deleteExpired();

      // Then
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            {
              revoked: true,
              revokedAt: { lt: expect.any(Date) },
            },
          ],
        },
      });
      expect(result).toBe(5);
    });

    it('should return 0 when no tokens to delete', async () => {
      // Given
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      // When
      const result = await repository.deleteExpired();

      // Then
      expect(result).toBe(0);
    });
  });

  describe('token hashing consistency', () => {
    it('should produce the same hash for the same input token across different operations', async () => {
      // Given
      const token = 'consistent-token';
      const expectedHash = hashToken(token);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-123',
        expiresAt: new Date(),
        revoked: false,
      });

      // When — create and findByToken should use the same hash
      await repository.create('user-123', token, new Date());
      await repository.findByToken(token);

      // Then — both calls should use the same hash
      const createCall = prisma.refreshToken.create.mock.calls[0][0];
      const findCall = prisma.refreshToken.findUnique.mock.calls[0][0];

      expect(createCall.data.tokenHash).toBe(expectedHash);
      expect(findCall.where.tokenHash).toBe(expectedHash);
    });

    it('should produce different hashes for different tokens', async () => {
      // Given
      const token1 = 'token-one';
      const token2 = 'token-two';
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      // When
      await repository.create('user-123', token1, new Date());
      await repository.create('user-456', token2, new Date());

      // Then
      const hash1 = prisma.refreshToken.create.mock.calls[0][0].data.tokenHash;
      const hash2 = prisma.refreshToken.create.mock.calls[1][0].data.tokenHash;

      expect(hash1).not.toBe(hash2);
    });
  });
});
