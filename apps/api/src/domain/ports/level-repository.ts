import type { Level } from '../entities/level';

export interface LevelRepository {
  findById(id: string): Promise<Level | null>;
  findBySlug(slug: string): Promise<Level | null>;
  findAll(): Promise<Level[]>;
  create(level: Omit<Level, 'createdAt'>): Promise<Level>;
  update(id: string, data: Partial<Level>): Promise<Level>;
  delete(id: string): Promise<void>;
}
