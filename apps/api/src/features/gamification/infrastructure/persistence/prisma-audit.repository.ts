/**
 * Prisma Gamification Audit Repository
 * Implements IGamificationAuditRepository for logging gamification events.
 */

import type {
  IGamificationAuditRepository,
  GamificationAuditLogEntry,
} from '@/features/gamification/domain/ports/gamification.ports.js';
import { type PrismaClient } from '@/database/client.js';
import { toPrismaJson } from '@/shared/utils/prisma-json.js';

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class PrismaAuditRepository implements IGamificationAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async logEvent(entry: GamificationAuditLogEntry): Promise<void> {
    await this.prisma.gamificationAuditLog.create({
      data: {
        userId: entry.userId,
        eventType: entry.eventType,
        details: toPrismaJson(entry.details, 'audit.details'),
        xpAwarded: entry.xpAwarded,
        badgesAwarded: entry.badgesAwarded ? JSON.stringify(entry.badgesAwarded) : undefined,
        succeeded: entry.succeeded,
        errorMessage: entry.errorMessage ?? undefined,
        createdAt: entry.createdAt ?? new Date(),
      },
    });
  }

  async getLogsByUserId(userId: string, limit: number = 100): Promise<GamificationAuditLogEntry[]> {
    const logs = await this.prisma.gamificationAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      eventType: log.eventType,
      details: isJsonObject(log.details) ? log.details : undefined,
      xpAwarded: log.xpAwarded,
      badgesAwarded:
        typeof log.badgesAwarded === 'string'
          ? this.parseJsonStringArray(log.badgesAwarded)
          : undefined,
      succeeded: log.succeeded,
      errorMessage: log.errorMessage ?? undefined,
      createdAt: log.createdAt,
    }));
  }

  async getLogsByEventType(
    eventType: string,
    limit: number = 100,
  ): Promise<GamificationAuditLogEntry[]> {
    const logs = await this.prisma.gamificationAuditLog.findMany({
      where: { eventType },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      eventType: log.eventType,
      details: isJsonObject(log.details) ? log.details : undefined,
      xpAwarded: log.xpAwarded,
      badgesAwarded:
        typeof log.badgesAwarded === 'string'
          ? this.parseJsonStringArray(log.badgesAwarded)
          : undefined,
      succeeded: log.succeeded,
      errorMessage: log.errorMessage ?? undefined,
      createdAt: log.createdAt,
    }));
  }

  private parseJsonStringArray(value: string): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
