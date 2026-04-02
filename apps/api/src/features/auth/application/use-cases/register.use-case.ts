import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import { UserAlreadyExistsError } from '@/features/auth/domain/ports/user.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';
import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import type { User } from '@/features/auth/domain/entities/user.entity.js';
import { DEFAULT_COHORT } from '@/features/auth/domain/entities/user.entity.js';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  username?: string; // optional, derived from email if not provided
  age?: number;
}

export interface RegisterOutput {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

export class RegisterUseCase {
  constructor(
    private userRepo: IUserRepository,
    private hashingService: IHashingService,
    private tokenService: ITokenService,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new UserAlreadyExistsError(input.email);
    }

    // Derive username from email if not provided
    let username = input.username;
    if (!username) {
      username = await this.generateUniqueUsername(input.email);
    } else {
      // Check username uniqueness
      const existingUser = await this.userRepo.findByIdentifier(username);
      if (existingUser) {
        throw new UserAlreadyExistsError(input.email); // Re-use error for username too
      }
    }

    const passwordHash = await this.hashingService.hash(input.password);

    const user = await this.userRepo.create({
      email: input.email,
      passwordHash,
      name: input.name,
      username,
      role: 'STUDENT', // ALWAYS STUDENT - server-controlled
      age: input.age,
      quota: 0,
      cohort: DEFAULT_COHORT,
    });

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
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
