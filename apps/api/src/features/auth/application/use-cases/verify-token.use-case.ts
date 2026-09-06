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

export interface VerifyTokenResult {
  payload: AuthTokenPayload;
  user: {
    id: string;
    email: string;
    role: UserRole;
    username?: string;
    name: string;
    age?: number;
    quota: number;
  };
}

export class VerifyTokenUseCase {
  constructor(
    private userRepo: IUserRepository,
    private tokenService: ITokenService,
  ) {}

  async execute(token: string): Promise<VerifyTokenResult> {
    let payload: AuthTokenPayload;
    try {
      // The token service throws typed errors (TokenInvalidError / TokenExpiredError)
      // so no message-based classification is needed here.
      payload = this.tokenService.verifyToken(token) as AuthTokenPayload;
    } catch (error) {
      if (error instanceof TokenInvalidError || error instanceof TokenExpiredError) {
        throw error;
      }
      throw new TokenInvalidError();
    }

    const user = await this.userRepo.findById(payload.userId);
    if (!user) {
      throw new UserNotFoundError(payload.userId);
    }

    return {
      payload,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        username: user.username,
        name: user.name,
        age: user.age,
        quota: user.quota,
      },
    };
  }
}
