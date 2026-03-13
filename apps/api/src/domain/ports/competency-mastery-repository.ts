import type { CompetencyMastery } from '../entities/competency-mastery.js';

export interface CompetencyMasteryRepository {
  findById(id: string): Promise<CompetencyMastery | null>;
  findByUserId(userId: string): Promise<CompetencyMastery[]>;
  findByUserIdAndCompetencyId(
    userId: string,
    competencyId: string,
  ): Promise<CompetencyMastery | null>;
  upsert(
    data: Partial<CompetencyMastery> & { userId: string; competencyId: string; mastery: number },
  ): Promise<CompetencyMastery>;
  delete(id: string): Promise<void>;
}
