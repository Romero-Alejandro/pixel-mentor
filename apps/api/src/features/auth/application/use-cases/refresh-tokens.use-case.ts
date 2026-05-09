import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import type { IRefreshTokenService } from '@/features/auth/domain/ports/refresh-token.service.port.js';
import type { IRefreshTokenRepository } from '@/features/auth/domain/ports/refresh-token.repository.port.js';
import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { AuthTokens } from '@/features/auth/domain/entities/auth-tokens.entity.js';
import { AuthError } from '@/features/auth/domain/auth.errors.js';
import type { RefreshToken } from '@/features/auth/domain/entities/refresh-token.entity.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';
import { randomUUID } from 'node:crypto'; // Or a dedicated utility for UUID generation
import { parseExpiresIn } from '@/shared/utils/index.js'; // Import the new utility
import { config } from '@/shared/config/index.js'; // Import config

export class RefreshTokensUseCase {
  constructor(
    private readonly tokenService: ITokenService,
    private readonly refreshTokenService: IRefreshTokenService,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly userRepository: IUserRepository,
    private readonly hashingService: IHashingService,
  ) {}

  async execute(refreshToken: string): Promise<AuthTokens> {
    if (!refreshToken) {
      throw new AuthError('Refresh token is required', 'MISSING_REFRESH_TOKEN');
    }

    let decodedPayload: { userId: string; [key: string]: any };
    try {
      decodedPayload = this.refreshTokenService.verifyRefreshToken(refreshToken) as {
        userId: string;
      };
    } catch (error) {
      throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const { userId } = decodedPayload;

    const storedRefreshToken = await this.refreshTokenRepository.findByToken(refreshToken);

    if (
      !storedRefreshToken ||
      storedRefreshToken.revoked ||
      storedRefreshToken.expiresAt < new Date()
    ) {
      // If a token is compromised, revoke all tokens for the user
      if (storedRefreshToken && storedRefreshToken.userId) {
        await this.refreshTokenRepository.deleteAllForUser(storedRefreshToken.userId);
      }
      throw new AuthError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND');
    }

    // Revoke the old refresh token (implementing refresh token rotation)
    await this.refreshTokenRepository.revoke(storedRefreshToken.id);

    // Generate new access token
    const newAccessToken = this.tokenService.generateToken({ userId: user.id, role: user.role });

    // Generate new refresh token
    const newRefreshTokenString = randomUUID(); // Generate a new UUID for the refresh token
    const newRefreshTokenExpiresAt = parseExpiresIn(config.JWT_REFRESH_EXPIRES_IN);

    const newRefreshToken: Omit<RefreshToken, 'id' | 'createdAt' | 'updatedAt' | 'revokedAt'> = {
      userId: user.id,
      token: newRefreshTokenString,
      expiresAt: newRefreshTokenExpiresAt,
      revoked: false,
    };
    await this.refreshTokenRepository.create(newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenString,
    };
  }
}
