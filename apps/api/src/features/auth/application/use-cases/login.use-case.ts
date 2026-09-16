import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';
import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import type { IRefreshTokenRepository } from '@/features/auth/domain/ports/refresh-token.repository.port.js';
import type { User } from '@/features/auth/domain/entities/user.entity.js';
import { InvalidCredentialsError } from '@/features/auth/domain/auth.errors.js';
import { randomBytes } from 'node:crypto';

export interface LoginInput {
  identifier: string; // email OR username
  password: string;
}

export interface LoginOutput {
  user: Omit<User, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
}

export class LoginUseCase {
  constructor(
    private userRepo: IUserRepository,
    private hashingService: IHashingService,
    private accessTokenService: ITokenService,
    private refreshTokenRepo: IRefreshTokenRepository,
    private refreshTokenService: ITokenService, // Using ITokenService for compatibility
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepo.findByIdentifierWithPassword(input.identifier);
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const valid = await this.hashingService.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const { accessToken, refreshToken } = await this.generateAndStoreTokens(user);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  private async generateAndStoreTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.accessTokenService.generateToken(payload);

    // For refresh tokens, we generate a simple random string. The JWT will be created by refreshTokenService
    const refreshTokenString = randomBytes(32).toString('hex');
    const refreshTokenPayload = { ...payload, jti: refreshTokenString }; // jti is jwt id
    const refreshToken = this.refreshTokenService.generateToken(refreshTokenPayload);

    // Hash the token for storage
    const hashedRefreshToken = await this.hashingService.hash(refreshTokenString);

    // Invalidate old tokens and store new one
    await this.refreshTokenRepo.deleteByUserId(user.id);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Let's set a 7 day expiry for the stored token record

    await this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: hashedRefreshToken,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
