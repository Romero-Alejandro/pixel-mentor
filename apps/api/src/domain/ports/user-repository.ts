import type { User, UserRole } from '@/domain/entities/user';

export interface UserListOptions {
  role?: UserRole;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UserListResult {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;

  findById(id: string): Promise<User | null>;

  findByEmailWithPassword(email: string): Promise<User | null>;

  findByIdentifier(identifier: string): Promise<User | null>; // find by email OR username

  findByIdentifierWithPassword(identifier: string): Promise<User | null>; // find by email OR username, includes passwordHash

  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;

  updateRole(id: string, role: UserRole): Promise<User>;

  delete(id: string): Promise<void>;

  findAll(options: UserListOptions): Promise<UserListResult>;
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
