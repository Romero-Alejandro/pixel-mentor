import { randomUUID } from 'node:crypto';

import type { EventLogRepository } from '@/domain/ports/event-log-repository.js';
import type { EventLog, EventType } from '@/domain/entities/event-log.js';

export class LogEventUseCase {
  constructor(private eventLogRepo: EventLogRepository) {}

  async execute(sessionId: string, eventType: EventType, data?: any): Promise<{ eventId: string }> {
    const eventId = randomUUID();

    const event = {
      id: eventId,
      sessionId,
      eventType,
      data,
    } as Omit<EventLog, 'timestamp'>;

    await this.eventLogRepo.create(event);
    return { eventId };
  }
}
