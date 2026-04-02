export interface LevelConfig {
  level: number;
  title: string;
  minXP: number;
  icon: string;
}

export interface ILevelConfigRepository {
  findByLevel(level: number): Promise<LevelConfig | null>;
  findAll(): Promise<LevelConfig[]>;
}
