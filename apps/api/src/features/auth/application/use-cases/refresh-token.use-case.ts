import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { PrismaRefreshTokenRepository } from '@/features/auth/infrastructure/persistence/refresh-token.repository.js';
import type {
  JwtAccessTokenService,
  JwtRefreshTokenService,
} from '@/features/auth/infrastructure/token.adapter.js';

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
}

/**
 * Refresh Token Use Case - Implements token rotation.
 *
 * Security flow:
 * 1. Verify the refresh token signature
 * 2. Look up the token in the database
 * 3. Check it hasn't expired or been revoked
 * 4. Revoke the old token (rotation)
 * 5. Issue new access + refresh tokens
 */
export class RefreshTokenUseCase {
  constructor(
    private userRepository: IUserRepository,
    private refreshRepo: PrismaRefreshTokenRepository,
    private accessTokenService: JwtAccessTokenService,
    private refreshTokenService: JwtRefreshTokenService,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    // 1. Verify the refresh token signature and extract payload
    const payload = this.refreshTokenService.verifyToken(input.refreshToken) as {
      userId: string;
    };

    if (!payload.userId) {
      throw new Error('Invalid refresh token: missing userId');
    }

    // 2. Look up the token in the database
    const storedToken = await this.refreshRepo.findByToken(input.refreshToken);

    if (!storedToken) {
      throw new Error('Invalid refresh token');
    }

    // 3. Check if token has expired or been revoked
    if (storedToken.revoked) {
      // Possible token reuse attack - revoke all tokens for this user
      await this.refreshRepo.revokeAllForUser(storedToken.userId);
      throw new Error('Refresh token has been revoked. Please log in again.');
    }

    if (new Date() > storedToken.expiresAt) {
      await this.refreshRepo.revoke(input.refreshToken);
      throw new Error('Refresh token has expired');
    }

    // 4. Verify user still exists and is active
    const user = await this.userRepository.findById(storedToken.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 5. Revoke the old token (rotation)
    await this.refreshRepo.revoke(input.refreshToken);

    // 6. Issue new tokens
    const newAccessToken = this.accessTokenService.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const newRefreshToken = this.refreshTokenService.generateToken({
      userId: user.id,
    });

    // 7. Store the new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    await this.refreshRepo.create(user.id, newRefreshToken, expiresAt);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
