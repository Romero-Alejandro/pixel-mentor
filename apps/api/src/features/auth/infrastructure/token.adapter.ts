import jwt from 'jsonwebtoken';

import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import { TokenExpiredError, TokenInvalidError } from '@/features/auth/domain/auth.errors.js';
import { config } from '@/shared/config/index.js';
import { moduleLogger } from '@/shared/logger/logger.js';

const logger = moduleLogger('auth:token-adapter');

/**
 * Short-lived access token service.
 * Access tokens expire quickly (default: 15 minutes) to minimize
 * the window of opportunity if compromised.
 */
export class JwtAccessTokenService implements ITokenService {
  generateToken(payload: object): string {
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_ACCESS_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  verifyToken(token: string): { userId: string; jti?: string } {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      if (typeof decoded === 'string' || !decoded || !decoded.userId) {
        logger.debug({ hasPayload: Boolean(decoded) }, 'Access token payload failed validation');
        throw new TokenInvalidError();
      }
      return decoded as { userId: string; jti?: string };
    } catch (error) {
      if (error instanceof TokenInvalidError) {
        throw error;
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError();
      }
      throw new TokenInvalidError();
    }
  }
}

/**
 * Long-lived refresh token service.
 * Refresh tokens are stored in the database and support rotation
 * (re-issued on each use) and immediate revocation.
 */
export class JwtRefreshTokenService {
  private readonly secret: string;

  constructor() {
    // Dedicated secret — required by the env schema so refresh tokens are
    // never signed with the same key as short-lived access tokens.
    this.secret = config.JWT_REFRESH_SECRET;
  }

  generateToken(payload: object): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  verifyToken(token: string): { userId: string; jti: string } {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (typeof decoded === 'string' || !decoded || !decoded.userId || !decoded.jti) {
        logger.debug({ hasPayload: Boolean(decoded) }, 'Refresh token payload failed validation');
        throw new TokenInvalidError();
      }
      return decoded as { userId: string; jti: string };
    } catch (error) {
      if (error instanceof TokenInvalidError) {
        throw error;
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError();
      }
      throw new TokenInvalidError();
    }
  }
}
