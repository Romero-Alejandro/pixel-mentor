import jwt from 'jsonwebtoken';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { UserRole } from '@/domain/entities/user.js';
import {
  TokenInvalidError,
  TokenExpiredError,
  UserNotFoundError,
} from '@/domain/ports/auth-errors.js';
import { config } from '@/config/index.js';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export class VerifyTokenUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(token: string): Promise<AuthTokenPayload> {
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as AuthTokenPayload;
      const user = await this.userRepo.findById(payload.userId);
      if (!user) {
        throw new UserNotFoundError();
      }
      return payload;
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenInvalidError();
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError();
      }
      throw error;
    }
  }
}
