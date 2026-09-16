import { prisma, type Prisma } from '@/database/client';
import { type EventLog, EventType } from '@/features/session/domain/entities/event-log.entity';
import type { EventLogRepository } from '@/features/session/domain/ports/event-log.repository.port';
import { toPrismaJsonRequired } from '@/shared/utils/prisma-json.js';

/**
 * Default safety cap for event-log listings: one chatty session can generate
 * thousands of rows with full JSON payloads. Raise explicitly per call site —
 * larger reads should paginate instead.
 */
const DEFAULT_EVENT_LOG_LIMIT = 200;

const EVENT_TYPE_VALUES: Record<string, EventType> = Object.fromEntries(
  Object.values(EventType).map((value) => [value, value]),
);

/** Boundary guard: unknown enum values from the DB surface loudly. */
function toEventType(value: unknown): EventType {
  const mapped = typeof value === 'string' ? EVENT_TYPE_VALUES[value] : undefined;
  if (mapped === undefined) {
    throw new Error(`Unknown EventType "${String(value)}" from database`);
  }
  return mapped;
}

export class PrismaEventLogRepository implements EventLogRepository {
  async findById(id: string): Promise<EventLog | null> {
    const raw = await prisma.eventLog.findUnique({ where: { id } });
    return raw ? this.mapEventLog(raw) : null;
  }

  async findByUserId(userId: string, limit: number = 100): Promise<EventLog[]> {
    const raw = await prisma.eventLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return raw.map(this.mapEventLog);
  }

  async findBySessionId(sessionId: string, limit?: number): Promise<EventLog[]> {
    const raw = await prisma.eventLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: limit ?? DEFAULT_EVENT_LOG_LIMIT,
    });
    return raw.map(this.mapEventLog);
  }

  async findByType(eventType: EventType, limit: number = 100): Promise<EventLog[]> {
    const raw = await prisma.eventLog.findMany({
      where: { eventType },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return raw.map(this.mapEventLog);
  }

  async create(event: Omit<EventLog, 'timestamp'>): Promise<EventLog> {
    const raw = await prisma.eventLog.create({
      data: {
        userId: event.userId,
        sessionId: event.sessionId,
        eventType: event.eventType,
        data: toPrismaJsonRequired(event.data, 'event.data'),
      },
    });
    return this.mapEventLog(raw);
  }

  async deleteById(id: string): Promise<void> {
    await prisma.eventLog.delete({ where: { id } });
  }

  private mapEventLog(raw: {
    id: string;
    userId: string | null;
    sessionId: string | null;
    eventType: string;
    data: Prisma.JsonValue;
    timestamp: Date;
  }): EventLog {
    return {
      id: raw.id,
      userId: raw.userId ?? undefined,
      sessionId: raw.sessionId ?? undefined,
      eventType: toEventType(raw.eventType),
      data: raw.data,
      timestamp: raw.timestamp,
    };
  }
}
