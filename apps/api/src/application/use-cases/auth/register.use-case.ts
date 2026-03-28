import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { User } from '@/domain/entities/user.js';
import { DEFAULT_COHORT } from '@/domain/entities/user.js';
import { UserAlreadyExistsError } from '@/domain/ports/auth-errors.js';
import { config } from '@/config/index.js';

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

const TOKEN_EXPIRES_IN = '7d';

export class RegisterUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new UserAlreadyExistsError('email');
    }

    // Derive username from email if not provided
    let username = input.username;
    if (!username) {
      username = await this.generateUniqueUsername(input.email);
    } else {
      // Check username uniqueness
      const existingUser = await this.userRepo.findByIdentifier(username);
      if (existingUser) {
        throw new UserAlreadyExistsError('nombre de usuario');
      }
    }

    const passwordHash = await argon2.hash(input.password);

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
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: TOKEN_EXPIRES_IN,
    });
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
