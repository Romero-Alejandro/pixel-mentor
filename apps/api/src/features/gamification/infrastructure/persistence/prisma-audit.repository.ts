/**
 * Prisma Gamification Audit Repository
 * Implements IGamificationAuditRepository for logging gamification events.
 *
 * The audit log is write-only: nothing in the product reads it back, so the
 * historical read methods were removed. Rows live and die with their user
 * (see the FK added in migration 20261021203000_audit_log_user_fk).
 */

import type {
  IGamificationAuditRepository,
  GamificationAuditLogEntry,
} from '@/features/gamification/domain/ports/gamification.ports.js';
import { type PrismaClient } from '@/database/client.js';
import { toPrismaJson } from '@/shared/utils/prisma-json.js';

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
}
