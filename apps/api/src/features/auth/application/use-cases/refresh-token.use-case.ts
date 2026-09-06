import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { IRefreshTokenRepository } from '@/features/auth/domain/ports/refresh-token.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';
import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import {
  TokenInvalidError,
  TokenExpiredError,
  RefreshTokenRevokedError,
} from '@/features/auth/domain/auth.errors.js';
import { randomBytes } from 'node:crypto';

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
    let payload: { userId: string; jti: string };
    try {
      payload = this.refreshTokenService.verifyToken(input.refreshToken) as {
        userId: string;
        jti: string;
      };
    } catch (error) {
      // The token service throws typed errors (TokenExpiredError / TokenInvalidError)
      throw error instanceof TokenExpiredError || error instanceof TokenInvalidError
        ? error
        : new TokenInvalidError();
    }

    if (!payload.userId || !payload.jti) {
      throw new TokenInvalidError();
    }

    // Find the stored token by userId
    const storedToken = await this.refreshTokenRepo.findByUserId(payload.userId);

    if (!storedToken) {
      // If the token is not in the DB, it might be a replay attack
      // after the token was already used. Invalidate all tokens for the user.
      await this.refreshTokenRepo.deleteByUserId(payload.userId);
      throw new TokenInvalidError();
    }

    // Verify the JTI against the stored hash using compare (not re-hashing)
    const isValidJti = await this.hashingService.compare(payload.jti, storedToken.tokenHash);
    if (!isValidJti) {
      await this.refreshTokenRepo.deleteByUserId(payload.userId);
      throw new TokenInvalidError();
    }

    if (storedToken.revoked) {
      throw new RefreshTokenRevokedError();
    }

    if (new Date() > storedToken.expiresAt) {
      await this.refreshTokenRepo.delete(storedToken.id);
      throw new TokenExpiredError();
    }

    // Revoke the used token
    await this.refreshTokenRepo.revoke(storedToken.id);

    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      // Token belongs to a deleted user - treat as invalid and clear the session.
      await this.refreshTokenRepo.deleteByUserId(payload.userId);
      throw new TokenInvalidError();
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
