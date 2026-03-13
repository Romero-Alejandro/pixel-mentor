import type { User, UserRole } from '@/domain/entities/user';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;

  findById(id: string): Promise<User | null>;

  findByEmailWithPassword(email: string): Promise<User | null>;

  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;

  updateRole(id: string, role: UserRole): Promise<User>;

  delete(id: string): Promise<void>;
}

export class UserNotFoundError extends Error {
  readonly code = 'USER_NOT_FOUND' as const;
  readonly userId?: string;
  readonly userEmail?: string;

  constructor(identifier: string) {
    super(`User not found: ${identifier}`);
    this.name = 'UserNotFoundError';
    if (identifier.includes('@')) {
      this.userEmail = identifier;
    } else {
      this.userId = identifier;
    }
  }
}

export class UserAlreadyExistsError extends Error {
  readonly code = 'USER_ALREADY_EXISTS' as const;
  readonly email: string;

  constructor(email: string) {
    super(`User with email ${email} already exists`);
    this.name = 'UserAlreadyExistsError';
    this.email = email;
  }
}

export class InvalidCredentialsError extends Error {
  readonly code = 'INVALID_CREDENTIALS' as const;

  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}
