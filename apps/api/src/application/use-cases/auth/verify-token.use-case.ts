import jwt from 'jsonwebtoken';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { UserRole } from '@/domain/entities/user.js';
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
        throw new Error('User not found');
      }
      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      throw error;
    }
  }
}
