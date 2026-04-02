import { randomUUID } from 'node:crypto';

import type { EventLogRepository } from '@/features/session/domain/ports/event-log.repository.port';
import type { EventLog, EventType } from '@/features/session/domain/entities/event-log.entity';

export class LogEventUseCase {
  constructor(private eventLogRepo: EventLogRepository) {}

  async execute(
    sessionId: string,
    eventType: EventType,
    data?: unknown,
  ): Promise<{ eventId: string }> {
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
