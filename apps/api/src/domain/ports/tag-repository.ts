import type { Tag } from '../entities/tag.js';

export interface TagRepository {
  findById(id: string): Promise<Tag | null>;
  findAll(): Promise<Tag[]>;
  create(tag: Omit<Tag, 'id' | 'createdAt'>): Promise<Tag>;
  update(id: string, data: Partial<Tag>): Promise<Tag>;
  delete(id: string): Promise<void>;
}
