import { prisma } from '@/database/client.js';
import type { RefreshToken } from '@/features/auth/domain/entities/refresh-token.entity';
import type { IRefreshTokenRepository } from '@/features/auth/domain/ports/refresh-token.repository.port.js';

const mapToDomain = (entity: any): RefreshToken => {
  return {
    id: entity.id,
    userId: entity.userId,
    tokenHash: entity.tokenHash,
    expiresAt: entity.expiresAt,
    revoked: entity.revoked,
    revokedAt: entity.revokedAt,
    createdAt: entity.createdAt,
  };
};

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  async create(token: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    const created = await prisma.refreshToken.create({
      data: {
        userId: token.userId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
      },
    });
    return mapToDomain(created);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const token = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    return token ? mapToDomain(token) : null;
  }

  async findByUserId(userId: string): Promise<RefreshToken | null> {
    const token = await prisma.refreshToken.findFirst({
      where: { userId, revoked: false },
      orderBy: { createdAt: 'desc' },
    });
    return token ? mapToDomain(token) : null;
  }

  async revoke(tokenId: string): Promise<RefreshToken> {
    const updated = await prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revoked: true, revokedAt: new Date() },
    });
    return mapToDomain(updated);
  }

  async delete(tokenId: string): Promise<void> {
    try {
      await prisma.refreshToken.delete({ where: { id: tokenId } });
    } catch (error) {
      // handlePrismaError doesn't exist yet, but let's assume it would be a generic helper
      // For now, we can ignore not-found errors on delete.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as any).code === 'P2025'
      ) {
        return;
      }
      throw error;
    }
  }

  async deleteByUserId(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}
