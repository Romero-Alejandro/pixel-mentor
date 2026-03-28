import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { User } from '@/domain/entities/user.js';
import { InvalidCredentialsError } from '@/domain/ports/auth-errors.js';
import { config } from '@/config/index.js';

export interface LoginInput {
  identifier: string; // email OR username
  password: string;
}

export interface LoginOutput {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

const TOKEN_EXPIRES_IN = '7d';

export class LoginUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    // Use findByIdentifier to resolve email or username
    const user = await this.userRepo.findByIdentifierWithPassword(input.identifier);
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
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
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: TOKEN_EXPIRES_IN,
    });
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
