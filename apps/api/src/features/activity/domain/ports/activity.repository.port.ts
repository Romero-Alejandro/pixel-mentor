import type { Activity } from '../entities/activity.entity.js';

export interface ActivityRepository {
  findById(id: string): Promise<Activity | null>;
  findByConceptId(conceptId: string): Promise<Activity[]>;
  create(activity: Omit<Activity, 'createdAt'>): Promise<Activity>;
  update(id: string, data: Partial<Activity>): Promise<Activity>;
  delete(id: string): Promise<void>;
}
