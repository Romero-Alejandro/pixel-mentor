import { prisma } from '@/database/client';
import type { EventLog, EventType } from '@/features/session/domain/entities/event-log.entity';
import type { EventLogRepository } from '@/features/session/domain/ports/event-log.repository.port';

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

  async findBySessionId(sessionId: string): Promise<EventLog[]> {
    const raw = await prisma.eventLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
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
        data: event.data as never,
      },
    });
    return this.mapEventLog(raw);
  }

  async deleteById(id: string): Promise<void> {
    await prisma.eventLog.delete({ where: { id } });
  }

  private mapEventLog(raw: Record<string, unknown>): EventLog {
    return {
      id: raw.id as string,
      userId: raw.userId as string | undefined,
      sessionId: raw.sessionId as string | undefined,
      eventType: raw.eventType as EventType,
      data: raw.data,
      timestamp: raw.timestamp as Date,
    };
  }
}
