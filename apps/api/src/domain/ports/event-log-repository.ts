import type { EventLog } from '../entities/event-log';
import type { EventType } from '../entities/event-log';

export interface EventLogRepository {
  findById(id: string): Promise<EventLog | null>;
  findByUserId(userId: string, limit?: number): Promise<EventLog[]>;
  findBySessionId(sessionId: string): Promise<EventLog[]>;
  findByType(eventType: EventType, limit?: number): Promise<EventLog[]>;
  create(event: Omit<EventLog, 'timestamp'>): Promise<EventLog>;
  deleteById(id: string): Promise<void>;
}
