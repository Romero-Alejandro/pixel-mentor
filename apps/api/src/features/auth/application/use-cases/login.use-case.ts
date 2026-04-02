import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';
import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import type { User } from '@/features/auth/domain/entities/user.entity.js';
import { InvalidCredentialsError } from '@/features/auth/domain/auth.errors.js';

export interface LoginInput {
  identifier: string; // email OR username
  password: string;
}

export interface LoginOutput {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

export class LoginUseCase {
  constructor(
    private userRepo: IUserRepository,
    private hashingService: IHashingService,
    private tokenService: ITokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    // Use findByIdentifier to resolve email or username
    const user = await this.userRepo.findByIdentifierWithPassword(input.identifier);
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const valid = await this.hashingService.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  private generateToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    return this.tokenService.generateToken(payload);
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
