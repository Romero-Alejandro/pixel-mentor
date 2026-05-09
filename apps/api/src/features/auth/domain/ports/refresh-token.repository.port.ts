import type { RefreshToken } from '../entities/refresh-token.entity.js';

export interface IRefreshTokenRepository {
  /**
   * Finds a refresh token by its ID.
   */
  findById(id: string): Promise<RefreshToken | null>;

  /**
   * Finds a refresh token by its token string.
   */
  findByToken(token: string): Promise<RefreshToken | null>;

  /**
   * Creates a new refresh token.
   */
  create(refreshToken: Omit<RefreshToken, 'id' | 'createdAt' | 'updatedAt'>): Promise<RefreshToken>;

  /**
   * Updates an existing refresh token.
   */
  update(id: string, updates: Partial<RefreshToken>): Promise<RefreshToken>;

  /**
   * Revokes a refresh token by its ID.
   */
  revoke(id: string): Promise<void>;

  /**
   * Deletes a refresh token by its ID.
   */
  delete(id: string): Promise<void>;

  /**
   * Deletes all refresh tokens for a given user.
   */
  deleteAllForUser(userId: string): Promise<void>;
}
