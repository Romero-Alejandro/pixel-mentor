import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { User, UserRole } from '@/domain/entities/user.js';
import { DEFAULT_COHORT } from '@/domain/entities/user.js';
import { config } from '@/config/index.js';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  age?: number;
}

export interface RegisterOutput {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

const TOKEN_EXPIRES_IN = '7d';

export class RegisterUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new Error('User already exists');
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await this.userRepo.create({
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
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

  private generateToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: TOKEN_EXPIRES_IN,
    });
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
