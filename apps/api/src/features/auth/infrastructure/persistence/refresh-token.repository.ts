import { prisma, Prisma } from '@/database/client.js';
import type { RefreshToken } from '@/features/auth/domain/entities/refresh-token.entity';
import type { IRefreshTokenRepository } from '@/features/auth/domain/ports/refresh-token.repository.port.js';

interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  revokedAt: Date | null;
  createdAt: Date;
}

const mapToDomain = (entity: RefreshTokenRow): RefreshToken => {
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
    const found = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    return found ? mapToDomain(found) : null;
  }

  async findByUserId(userId: string): Promise<RefreshToken | null> {
    const found = await prisma.refreshToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return found ? mapToDomain(found) : null;
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
    } catch (error: unknown) {
      // Deleting an already-removed token is idempotent: P2025 (record not
      // found) is swallowed, any other failure surfaces.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return;
      }
      throw error;
    }
  }

  async deleteByUserId(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
