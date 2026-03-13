import { prisma } from '../client';
import type { EventLog, EventType } from '@/domain/entities/event-log';
import type { EventLogRepository } from '@/domain/ports/event-log-repository';

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
        data: event.data,
      },
    });
    return this.mapEventLog(raw);
  }

  async deleteById(id: string): Promise<void> {
    await prisma.eventLog.delete({ where: { id } });
  }

  private mapEventLog(raw: any): EventLog {
    return {
      id: raw.id,
      userId: raw.userId,
      sessionId: raw.sessionId,
      eventType: raw.eventType,
      data: raw.data,
      timestamp: raw.timestamp,
    };
  }
}
