import type { IRefreshTokenRepository } from '@/features/auth/domain/ports/refresh-token.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';

export interface LogoutInput {
  refreshToken?: string;
}

/**
 * Minimal structural type for the refresh token verifier.
 * Implemented by JwtRefreshTokenService (infrastructure).
 */
interface RefreshTokenVerifier {
  verifyToken(token: string): { userId: string; jti: string };
}

/**
 * Revokes the user's refresh tokens on logout.
 *
 * Logout does NOT require an authenticated request: the client may be
 * logging out with an already-expired access token, so the refresh token
 * itself (from the httpOnly cookie or the request body) is what gets revoked.
 */
export class LogoutUseCase {
  constructor(
    private refreshTokenRepo: IRefreshTokenRepository,
    private refreshTokenService: RefreshTokenVerifier,
    private hashingService: IHashingService,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    if (!input.refreshToken) return;

    try {
      const payload = this.refreshTokenService.verifyToken(input.refreshToken);

      // Revoke the presented token if it is still the user's active one.
      const storedToken = await this.refreshTokenRepo.findByUserId(payload.userId);
      if (storedToken) {
        const matches = await this.hashingService.compare(payload.jti, storedToken.tokenHash);
        if (matches) {
          await this.refreshTokenRepo.revoke(storedToken.id);
        }
      }

      // Full logout: remove every remaining refresh token for the user.
      await this.refreshTokenRepo.deleteByUserId(payload.userId);
    } catch (error) {
      // Best-effort: logout must never fail the request (the client clears its
      // session locally regardless). Also avoid leaking token validity.
      console.error('Error during logout', error);
    }
  }
}
