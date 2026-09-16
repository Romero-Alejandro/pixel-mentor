import type { RefreshToken } from '@/features/auth/domain/entities/refresh-token.entity.js';

export interface IRefreshTokenRepository {
  create(token: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken>;

  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;

  findByUserId(userId: string): Promise<RefreshToken | null>;

  revoke(tokenId: string): Promise<RefreshToken>;

  delete(tokenId: string): Promise<void>;

  deleteByUserId(userId: string): Promise<void>;
}
