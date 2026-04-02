import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import type { UserRole } from '@/features/auth/domain/entities/user.entity.js';
import {
  TokenInvalidError,
  TokenExpiredError,
  UserNotFoundError,
} from '@/features/auth/domain/auth.errors.js';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export class VerifyTokenUseCase {
  constructor(
    private userRepo: IUserRepository,
    private tokenService: ITokenService,
  ) {}

  async execute(token: string): Promise<AuthTokenPayload> {
    try {
      const payload = this.tokenService.verifyToken(token) as AuthTokenPayload;
      const user = await this.userRepo.findById(payload.userId);
      if (!user) {
        throw new UserNotFoundError(payload.userId);
      }
      return payload;
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }
      if (error instanceof TokenInvalidError || error instanceof TokenExpiredError) {
        throw error;
      }
      // Check if it's a generic error from token verification
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('expired')) {
        throw new TokenExpiredError();
      }
      throw new TokenInvalidError();
    }
  }
}
