import jwt from 'jsonwebtoken';
import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import { config } from '@/shared/config/index.js';

const TOKEN_EXPIRES_IN = '7d';

/**
 * JSON Web Token implementation of the token service port.
 */
export class JwtTokenService implements ITokenService {
  generateToken(payload: object): string {
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: TOKEN_EXPIRES_IN,
    });
  }

  verifyToken(token: string): object {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    // Handle both string and JwtPayload return types
    if (typeof decoded === 'string') {
      return {};
    }
    return decoded as object;
  }
}
