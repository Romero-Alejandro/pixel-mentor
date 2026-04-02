import type { User, UserRole } from '@/features/auth/domain/entities/user.entity.js';
import { DEFAULT_COHORT } from '@/features/auth/domain/entities/user.entity.js';
import type {
  IUserRepository,
  UserListOptions,
  UserListResult,
} from '@/features/auth/domain/ports/user.repository.port.js';
import {
  UserAlreadyExistsError,
  UserNotFoundError,
} from '@/features/auth/domain/ports/user.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';
import { ForbiddenError } from '@/features/auth/domain/auth.errors.js';

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  username?: string;
  role: UserRole;
  age?: number;
}

export interface UpdateRoleInput {
  userId: string;
  role: UserRole;
}

export class AdminUserService {
  constructor(
    private userRepo: IUserRepository,
    private hashingService: IHashingService,
  ) {}

  /**
   * Create a user with any role (ADMIN only).
   * Security validations:
   * - Email must be unique
   * - Username (if provided) must be unique
   * - Password minimum 6 characters (handled at route level)
   */
  async createUser(input: CreateUserInput): Promise<Omit<User, 'passwordHash'>> {
    // Check email uniqueness
    const existingEmail = await this.userRepo.findByEmail(input.email);
    if (existingEmail) {
      throw new UserAlreadyExistsError(input.email);
    }

    // Generate or validate username
    let username = input.username;
    if (!username) {
      username = await this.generateUniqueUsername(input.email);
    } else {
      const existingUsername = await this.userRepo.findByIdentifier(username);
      if (existingUsername) {
        throw new UserAlreadyExistsError(input.email);
      }
    }

    const passwordHash = await this.hashingService.hash(input.password);

    const user = await this.userRepo.create({
      email: input.email,
      passwordHash,
      name: input.name,
      username,
      role: input.role,
      age: input.age,
      quota: 0,
      cohort: DEFAULT_COHORT,
    });

    return this.sanitizeUser(user);
  }

  /**
   * List users with optional filters and pagination.
   */
  async listUsers(options: UserListOptions): Promise<UserListResult> {
    return this.userRepo.findAll(options);
  }

  /**
   * Get a single user by ID.
   */
  async getUser(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    return this.sanitizeUser(user);
  }

  /**
   * Change a user's role.
   * Security validations:
   * - Cannot demote yourself (the admin making the request)
   * - Target user must exist
   */
  async updateUserRole(
    targetUserId: string,
    newRole: UserRole,
    requestingAdminId: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    // Security: prevent self-demotion
    if (targetUserId === requestingAdminId) {
      throw new ForbiddenError('No puedes cambiar tu propio rol');
    }

    // Verify target exists
    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) {
      throw new UserNotFoundError(targetUserId);
    }

    const updated = await this.userRepo.updateRole(targetUserId, newRole);
    return this.sanitizeUser(updated);
  }

  /**
   * Delete a user.
   * Security validations:
   * - Cannot delete yourself
   * - Target user must exist
   */
  async deleteUser(targetUserId: string, requestingAdminId: string): Promise<void> {
    // Security: prevent self-deletion
    if (targetUserId === requestingAdminId) {
      throw new ForbiddenError('No puedes eliminar tu propia cuenta');
    }

    // Verify target exists
    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) {
      throw new UserNotFoundError(targetUserId);
    }

    await this.userRepo.delete(targetUserId);
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

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
