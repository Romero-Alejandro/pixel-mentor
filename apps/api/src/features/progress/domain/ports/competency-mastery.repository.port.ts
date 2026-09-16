import type { CompetencyMastery } from '@/features/progress/domain/entities/competency-mastery.entity.js';

export interface CompetencyMasteryRepository {
  findById(id: string): Promise<CompetencyMastery | null>;
  findByUserId(userId: string, limit?: number): Promise<CompetencyMastery[]>;
  findByUserIdAndCompetencyId(
    userId: string,
    competencyId: string,
  ): Promise<CompetencyMastery | null>;
  upsert(
    data: Partial<CompetencyMastery> & { userId: string; competencyId: string; mastery: number },
  ): Promise<CompetencyMastery>;
  delete(id: string): Promise<void>;
}
