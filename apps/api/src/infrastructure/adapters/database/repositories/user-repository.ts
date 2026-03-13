import { prisma } from '../client.js';
import { handlePrismaError } from '../error-handler.js';

import type { User, UserRole } from '@/domain/entities/user.js';
import type { UserRepository } from '@/domain/ports/user-repository.js';
import { UserNotFoundError, UserAlreadyExistsError } from '@/domain/ports/user-repository.js';

type PrismaUser = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

type PrismaUserWithoutPassword = Omit<PrismaUser, 'passwordHash'>;

const mapToDomain = (entity: PrismaUserWithoutPassword): User => {
  return {
    id: entity.id,
    email: entity.email,
    name: entity.name,
    role: entity.role as UserRole,
    age: entity.age ?? undefined,
    quota: entity.quota,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
};

const mapToDomainWithPassword = (entity: PrismaUser): User => {
  return {
    id: entity.id,
    email: entity.email,
    name: entity.name,
    role: entity.role as UserRole,
    age: entity.age ?? undefined,
    quota: entity.quota,
    passwordHash: entity.passwordHash,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
};

export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        age: true,
        quota: true,
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
        name: true,
        role: true,
        age: true,
        quota: true,
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

  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    if (!user.passwordHash) {
      throw new Error('Password hash is required');
    }

    try {
      const created = await prisma.user.create({
        data: {
          email: user.email,
          passwordHash: user.passwordHash, // non-null, checked above
          name: user.name,
          role: user.role,
          age: user.age ?? null,
          quota: user.quota ?? 0,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          age: true,
          quota: true,
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
          name: true,
          role: true,
          age: true,
          quota: true,
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
}
