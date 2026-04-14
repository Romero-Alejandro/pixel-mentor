import { createHash } from 'node:crypto';

import { prisma } from '@/database/client.js';

/**
 * Prisma-based refresh token repository.
 * Handles storage, rotation, and revocation of refresh tokens.
 */
export class PrismaRefreshTokenRepository {
  /**
   * Store a new refresh token (hashed) in the database.
   */
  async create(userId: string, token: string, expiresAt: Date): Promise<void> {
    const tokenHash = this.hashToken(token);
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  /**
   * Find a refresh token by its raw value (hashes and looks up).
   */
  async findByToken(token: string): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
    revoked: boolean;
  } | null> {
    const tokenHash = this.hashToken(token);
    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revoked: true,
      },
    });
    return record;
  }

  /**
   * Revoke a specific refresh token.
   */
  async revoke(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke all refresh tokens for a user (e.g., on password change or logout all).
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Delete expired tokens (cleanup job).
   */
  async deleteExpired(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revoked: true, revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });
    return result.count;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
