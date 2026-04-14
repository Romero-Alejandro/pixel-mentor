import jwt from 'jsonwebtoken';

import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import { config } from '@/shared/config/index.js';

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

  verifyToken(token: string): object {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (typeof decoded === 'string') {
      return {};
    }
    return decoded as object;
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
    // Use dedicated refresh secret if configured, fallback to JWT_SECRET
    this.secret = config.JWT_REFRESH_SECRET ?? config.JWT_SECRET;
  }

  generateToken(payload: object): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  verifyToken(token: string): object {
    const decoded = jwt.verify(token, this.secret);
    if (typeof decoded === 'string') {
      return {};
    }
    return decoded as object;
  }
}
