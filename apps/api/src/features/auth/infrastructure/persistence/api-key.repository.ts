import { prisma } from '@/database/client.js';
import type { ApiKey } from '@/features/auth/domain/entities/api-key.entity.js';
import type { IApiKeyRepository } from '@/features/auth/domain/ports/api-key.repository.port.js';
import { ApiKeyNotFoundError } from '@/features/auth/domain/ports/api-key.repository.port.js';

type PrismaApiKey = Awaited<ReturnType<typeof prisma.apiKey.findUnique>>;

function mapToDomain(prismaEntity: NonNullable<PrismaApiKey>): ApiKey {
  return {
    id: prismaEntity.id,
    keyHash: prismaEntity.keyHash,
    userId: prismaEntity.userId,
    lastUsedAt: prismaEntity.lastUsedAt,
    usageCount: prismaEntity.usageCount,
    isActive: prismaEntity.isActive,
    createdAt: prismaEntity.createdAt,
    updatedAt: prismaEntity.updatedAt,
  };
}

export class PrismaApiKeyRepository implements IApiKeyRepository {
  async findById(id: string): Promise<ApiKey | null> {
    const apiKey = await prisma.apiKey.findUnique({ where: { id } });
    return apiKey ? mapToDomain(apiKey) : null;
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
    return apiKey ? mapToDomain(apiKey) : null;
  }

  async findByUserId(userId: string): Promise<ApiKey[]> {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return apiKeys.map(mapToDomain);
  }

  async create(
    apiKey: Omit<ApiKey, 'lastUsedAt' | 'usageCount' | 'createdAt' | 'updatedAt'>,
  ): Promise<ApiKey> {
    const created = await prisma.apiKey.create({
      data: {
        id: apiKey.id,
        keyHash: apiKey.keyHash,
        userId: apiKey.userId,
        lastUsedAt: null,
        usageCount: 0,
        isActive: true,
      },
    });
    return mapToDomain(created);
  }

  async incrementUsage(keyId: string): Promise<ApiKey> {
    try {
      const updated = await prisma.apiKey.update({
        where: { id: keyId },
        data: {
          usageCount: { increment: 1 } as unknown as undefined,
          lastUsedAt: new Date(),
        },
      });
      return mapToDomain(updated);
    } catch {
      throw new ApiKeyNotFoundError(keyId);
    }
  }

  async deactivate(keyId: string): Promise<ApiKey> {
    try {
      const updated = await prisma.apiKey.update({
        where: { id: keyId },
        data: { isActive: false },
      });
      return mapToDomain(updated);
    } catch {
      throw new ApiKeyNotFoundError(keyId);
    }
  }
}
