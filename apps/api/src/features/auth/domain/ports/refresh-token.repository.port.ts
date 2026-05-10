import type { RefreshToken } from '../entities/refresh-token.entity';

export interface IRefreshTokenRepository {
  create(token: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken>;

  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;

  revoke(tokenId: string): Promise<RefreshToken>;

  delete(tokenId: string): Promise<void>;

  deleteByUserId(userId: string): Promise<void>;
}
