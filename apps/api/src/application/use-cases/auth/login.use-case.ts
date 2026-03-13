import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { User } from '@/domain/entities/user.js';
import { config } from '@/config/index.js';

export interface LoginInput {
  email: string;
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
    const user = await this.userRepo.findByEmailWithPassword(input.email);
    if (!user || !user.passwordHash) {
      console.log('[LoginUseCase] User not found or no password hash');
      throw new Error('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      console.log('[LoginUseCase] Invalid password');
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user);
    console.log('[LoginUseCase] Token generated for user:', user.email);

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
