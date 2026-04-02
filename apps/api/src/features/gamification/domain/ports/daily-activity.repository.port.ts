export interface IDailyActivityRepository {
  recordActivity(userId: string, date: Date): Promise<void>;
}
