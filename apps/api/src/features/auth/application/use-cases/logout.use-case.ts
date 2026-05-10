import type { IRefreshTokenRepository } from '@/features/auth/domain/ports/refresh-token.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';

export interface LogoutInput {
  userId: string;
  refreshToken: string;
}

export class LogoutUseCase {
  constructor(
    private refreshTokenRepo: IRefreshTokenRepository,
    private hashingService: IHashingService
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    try {
        // Revoke ALL refresh tokens for the user to ensure complete logout
        await this.refreshTokenRepo.deleteByUserId(input.userId);
    } catch(e) {
        // Silently fail to avoid leaking information
        console.error("Error during logout", e);
    }
  }
}
