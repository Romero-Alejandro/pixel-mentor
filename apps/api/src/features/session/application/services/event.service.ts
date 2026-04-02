import { randomUUID } from 'node:crypto';

import type { EventLogRepository } from '@/features/session/domain/ports/event-log.repository.port.js';
import type { EventLog, EventType } from '@/features/session/domain/entities/event-log.entity.js';

export class EventService {
  constructor(private eventLogRepo: EventLogRepository) {}

  async log(sessionId: string, eventType: EventType, data?: unknown): Promise<void> {
    const eventId = randomUUID();

    const event = {
      id: eventId,
      sessionId,
      eventType,
      data,
    } as Omit<EventLog, 'timestamp'>;

    await this.eventLogRepo.create(event);
  }
}
