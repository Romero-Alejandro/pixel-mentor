import { prisma } from '@/database/client.js';
import { handlePrismaError } from '@/database/error-handler.js';

import type { User, UserRole } from '@/features/auth/domain/entities/user.entity.js';
import { DEFAULT_COHORT } from '@/features/auth/domain/entities/user.entity.js';
import type {
  IUserRepository,
  UserListOptions,
  UserListResult,
} from '@/features/auth/domain/ports/user.repository.port.js';
import {
  UserNotFoundError,
  UserAlreadyExistsError,
} from '@/features/auth/domain/ports/user.repository.port.js';

type PrismaUser = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

type PrismaUserWithoutPassword = Omit<PrismaUser, 'passwordHash'>;

const mapToDomain = (entity: PrismaUserWithoutPassword): User => {
  return {
    id: entity.id,
    email: entity.email,
    username: entity.username ?? undefined,
    name: entity.name,
    role: entity.role as UserRole,
    age: entity.age ?? undefined,
    quota: entity.quota,
    cohort: entity.cohort ?? DEFAULT_COHORT,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
};

const mapToDomainWithPassword = (entity: PrismaUser): User => {
  return {
    id: entity.id,
    email: entity.email,
    username: entity.username ?? undefined,
    name: entity.name,
    role: entity.role as UserRole,
    age: entity.age ?? undefined,
    quota: entity.quota,
    cohort: entity.cohort ?? DEFAULT_COHORT,
    passwordHash: entity.passwordHash,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
};

export class PrismaUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        age: true,
        quota: true,
        cohort: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user ? mapToDomain(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        age: true,
        quota: true,
        cohort: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user ? mapToDomain(user) : null;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    return user ? mapToDomainWithPassword(user) : null;
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    // identifier can be either email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        age: true,
        quota: true,
        cohort: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user ? mapToDomain(user) : null;
  }

  async findByIdentifierWithPassword(identifier: string): Promise<User | null> {
    // identifier can be either email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });
    return user ? mapToDomainWithPassword(user) : null;
  }

  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    if (!user.passwordHash) {
      throw new Error('Password hash is required');
    }

    try {
      const created = await prisma.user.create({
        data: {
          email: user.email,
          username: user.username,
          passwordHash: user.passwordHash, // non-null, checked above
          name: user.name,
          role: user.role,
          age: user.age ?? null,
          quota: user.quota ?? 0,
          cohort: user.cohort ?? DEFAULT_COHORT,
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          age: true,
          quota: true,
          cohort: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return mapToDomain(created);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const prismaError = error as { code: string };
        if (prismaError.code === 'P2002') {
          throw new UserAlreadyExistsError(user.email);
        }
      }
      throw error;
    }
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    try {
      const updated = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          age: true,
          quota: true,
          cohort: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return mapToDomain(updated);
    } catch (error) {
      handlePrismaError(error, UserNotFoundError, id);
      throw error;
    }
  }

  async updateQuota(id: string, quota: number): Promise<User> {
    try {
      const updated = await prisma.user.update({
        where: { id },
        data: { quota },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          age: true,
          quota: true,
          cohort: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return mapToDomain(updated);
    } catch (error) {
      handlePrismaError(error, UserNotFoundError, id);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.user.delete({ where: { id } });
    } catch (error) {
      handlePrismaError(error, UserNotFoundError, id);
    }
  }

  async findAll(options: UserListOptions = {}): Promise<UserListResult> {
    const { role, search, page = 1, limit = 20 } = options;

    const where: Record<string, unknown> = {};

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          age: true,
          quota: true,
          cohort: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map(mapToDomain),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
