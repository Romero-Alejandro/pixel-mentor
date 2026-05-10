import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import { UserAlreadyExistsError } from '@/features/auth/domain/ports/user.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';
import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import type { IRefreshTokenRepository } from '@/features/auth/domain/ports/refresh-token.repository.port.js';
import type { User } from '@/features/auth/domain/entities/user.entity.js';
import { DEFAULT_COHORT } from '@/features/auth/domain/entities/user.entity.js';
import { randomBytes } from 'crypto';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  username?: string; // optional, derived from email if not provided
  age?: number;
}

export interface RegisterOutput {
  user: Omit<User, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
}

export class RegisterUseCase {
  constructor(
    private userRepo: IUserRepository,
    private hashingService: IHashingService,
    private accessTokenService: ITokenService,
    private refreshTokenRepo: IRefreshTokenRepository,
    private refreshTokenService: ITokenService,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new UserAlreadyExistsError(input.email);
    }

    let username = input.username;
    if (!username) {
      username = await this.generateUniqueUsername(input.email);
    } else {
      const existingUser = await this.userRepo.findByIdentifier(username);
      if (existingUser) {
        throw new UserAlreadyExistsError(input.email);
      }
    }

    const passwordHash = await this.hashingService.hash(input.password);

    const user = await this.userRepo.create({
      email: input.email,
      passwordHash,
      name: input.name,
      username,
      role: 'STUDENT',
      age: input.age,
      quota: 0,
      cohort: DEFAULT_COHORT,
    });

    const { accessToken, refreshToken } = await this.generateAndStoreTokens(user);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    let username = baseUsername;
    let counter = 1;

    while (true) {
      const existing = await this.userRepo.findByIdentifier(username);
      if (!existing) {
        return username;
      }
      username = `${baseUsername}${counter}`;
      counter++;
    }
  }
  
  private async generateAndStoreTokens(user: User): Promise<{ accessToken: string; refreshToken: string; }> {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.accessTokenService.generateToken(payload);
    
    const refreshTokenString = randomBytes(32).toString('hex');
    const refreshTokenPayload = { ...payload, jti: refreshTokenString };
    const refreshToken = this.refreshTokenService.generateToken(refreshTokenPayload);
    
    const hashedRefreshToken = await this.hashingService.hash(refreshTokenString);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: hashedRefreshToken,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}

