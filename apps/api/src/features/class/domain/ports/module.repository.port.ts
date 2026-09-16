import type { Module } from '@/features/class/domain/entities/module.entity.js';

export interface ModuleRepository {
  findById(id: string): Promise<Module | null>;
  findBySlug(slug: string): Promise<Module | null>;
  findByLevelId(levelId: string): Promise<Module[]>;
  create(module: Omit<Module, 'createdAt'>): Promise<Module>;
  update(id: string, data: Partial<Module>): Promise<Module>;
  delete(id: string): Promise<void>;
}
