import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { IRefreshTokenRepository } from '@/features/auth/domain/ports/refresh-token.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';
import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import { randomBytes } from 'crypto';

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
}

export class RefreshTokenUseCase {
  constructor(
    private userRepository: IUserRepository,
    private refreshTokenRepo: IRefreshTokenRepository,
    private accessTokenService: ITokenService,
    private refreshTokenService: ITokenService,
    private hashingService: IHashingService,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    const payload = this.refreshTokenService.verifyToken(input.refreshToken) as {
      userId: string;
      jti: string;
    };

    if (!payload.userId || !payload.jti) {
      throw new Error('Invalid refresh token payload');
    }
    
    const tokenHash = await this.hashingService.hash(payload.jti);
    const storedToken = await this.refreshTokenRepo.findByTokenHash(tokenHash);

    if (!storedToken) {
      // If the token is not in the DB, it might be a replay attack
      // after the token was already used. Invalidate all tokens for the user.
      await this.refreshTokenRepo.deleteByUserId(payload.userId);
      throw new Error('Invalid refresh token');
    }
    
    if (storedToken.revoked) {
        throw new Error('Refresh token has been revoked');
    }

    if (new Date() > storedToken.expiresAt) {
      await this.refreshTokenRepo.delete(storedToken.id);
      throw new Error('Refresh token has expired');
    }

    // Revoke the used token
    await this.refreshTokenRepo.revoke(storedToken.id);

    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Issue new tokens
    const newAccessToken = this.accessTokenService.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    
    const newRefreshTokenString = randomBytes(32).toString('hex');
    const newRefreshTokenPayload = { userId: user.id, jti: newRefreshTokenString };
    const newRefreshToken = this.refreshTokenService.generateToken(newRefreshTokenPayload);
    
    const newHashedRefreshToken = await this.hashingService.hash(newRefreshTokenString);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: newHashedRefreshToken,
      expiresAt,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}

