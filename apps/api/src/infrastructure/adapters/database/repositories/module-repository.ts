import { prisma } from '../client';

import type { Module } from '@/domain/entities/module';
import type { ModuleRepository } from '@/domain/ports/module-repository';

export class PrismaModuleRepository implements ModuleRepository {
  async findById(id: string): Promise<Module | null> {
    const raw = await prisma.module.findUnique({ where: { id } });
    return raw ? this.mapModule(raw) : null;
  }

  async findBySlug(slug: string): Promise<Module | null> {
    const raw = await prisma.module.findUnique({ where: { slug } });
    return raw ? this.mapModule(raw) : null;
  }

  async findByLevelId(levelId: string): Promise<Module[]> {
    const raw = await prisma.module.findMany({ where: { levelId } });
    return raw.map(this.mapModule);
  }

  async create(module: Omit<Module, 'createdAt'>): Promise<Module> {
    const raw = await prisma.module.create({
      data: {
        slug: module.slug,
        name: module.name,
        levelId: module.levelId,
      },
    });
    return this.mapModule(raw);
  }

  async update(id: string, data: Partial<Module>): Promise<Module> {
    const raw = await prisma.module.update({
      where: { id },
      data: {
        slug: data.slug,
        name: data.name,
        levelId: data.levelId,
      },
    });
    return this.mapModule(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.module.delete({ where: { id } });
  }

  private mapModule(raw: any): Module {
    return {
      id: raw.id,
      slug: raw.slug,
      name: raw.name,
      levelId: raw.levelId,
      recipes: [],
      createdAt: raw.createdAt,
    };
  }
}
