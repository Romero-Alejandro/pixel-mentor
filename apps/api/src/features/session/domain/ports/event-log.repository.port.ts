import type { EventLog, EventType } from '@/features/session/domain/entities/event-log.entity.js';

export interface EventLogRepository {
  findById(id: string): Promise<EventLog | null>;
  findByUserId(userId: string, limit?: number): Promise<EventLog[]>;
  findBySessionId(sessionId: string, limit?: number): Promise<EventLog[]>;
  findByType(eventType: EventType, limit?: number): Promise<EventLog[]>;
  create(event: Omit<EventLog, 'timestamp'>): Promise<EventLog>;
  deleteById(id: string): Promise<void>;
}
