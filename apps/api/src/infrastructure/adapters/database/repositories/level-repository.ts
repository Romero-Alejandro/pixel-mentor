import { prisma } from '../client';
import type { Level } from '@/domain/entities/level';
import type { LevelRepository } from '@/domain/ports/level-repository';

export class PrismaLevelRepository implements LevelRepository {
  async findById(id: string): Promise<Level | null> {
    const raw = await prisma.level.findUnique({ where: { id } });
    return raw ? this.mapLevel(raw) : null;
  }

  async findBySlug(slug: string): Promise<Level | null> {
    const raw = await prisma.level.findUnique({ where: { slug } });
    return raw ? this.mapLevel(raw) : null;
  }

  async findAll(): Promise<Level[]> {
    const raw = await prisma.level.findMany();
    return raw.map(this.mapLevel);
  }

  async create(level: Omit<Level, 'createdAt'>): Promise<Level> {
    const raw = await prisma.level.create({
      data: {
        slug: level.slug,
        name: level.name,
        minAge: level.minAge,
        maxAge: level.maxAge,
      },
    });
    return this.mapLevel(raw);
  }

  async update(id: string, data: Partial<Level>): Promise<Level> {
    const raw = await prisma.level.update({
      where: { id },
      data: {
        slug: data.slug,
        name: data.name,
        minAge: data.minAge,
        maxAge: data.maxAge,
      },
    });
    return this.mapLevel(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.level.delete({ where: { id } });
  }

  private mapLevel(raw: any): Level {
    return {
      id: raw.id,
      slug: raw.slug,
      name: raw.name,
      minAge: raw.minAge,
      maxAge: raw.maxAge,
      modules: [],
      createdAt: raw.createdAt,
    };
  }
}
