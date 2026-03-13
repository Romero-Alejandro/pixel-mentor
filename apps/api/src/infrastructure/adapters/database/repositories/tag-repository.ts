import { prisma } from '../client.js';
import type { Tag } from '@/domain/entities/tag.js';
import type { TagRepository } from '@/domain/ports/tag-repository.js';

export class PrismaTagRepository implements TagRepository {
  async findById(id: string): Promise<Tag | null> {
    const raw = await prisma.tag.findUnique({ where: { id } });
    return raw ? this.mapToDomain(raw) : null;
  }

  async findAll(): Promise<Tag[]> {
    const raw = await prisma.tag.findMany();
    return raw.map(this.mapToDomain);
  }

  async create(tag: Omit<Tag, 'id' | 'createdAt'>): Promise<Tag> {
    const raw = await prisma.tag.create({
      data: {
        name: tag.name,
      },
    });
    return this.mapToDomain(raw);
  }

  async update(id: string, data: Partial<Tag>): Promise<Tag> {
    const raw = await prisma.tag.update({
      where: { id },
      data: {
        name: data.name,
      },
    });
    return this.mapToDomain(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.tag.delete({ where: { id } });
  }

  private mapToDomain(raw: any): Tag {
    return {
      id: raw.id,
      name: raw.name,
    };
  }
}
