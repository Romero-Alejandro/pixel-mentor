export interface CompetencyMastery {
  readonly id: string;
  readonly userId: string;
  readonly competencyId: string;
  readonly mastery: number;
  readonly lastUpdated: Date;
}
