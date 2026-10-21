export interface IDailyActivityRepository {
  /**
   * Records the user as active on `date` (normalized to a UTC day).
   * Idempotent and safe to call concurrently for the same day.
   */
  recordActivity(userId: string, date: Date): Promise<void>;

  /**
   * Calendar days with activity since `since` (inclusive), oldest first.
   * Omit `since` to load the whole calendar.
   */
  getActivityDates(userId: string, since?: Date): Promise<Date[]>;
}
