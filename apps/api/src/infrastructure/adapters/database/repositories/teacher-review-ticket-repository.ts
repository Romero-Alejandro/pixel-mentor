import { prisma } from '../client.js';
import { handlePrismaError } from '../error-handler.js';

import type { TeacherReviewTicket, TicketStatus } from '@/domain/entities/teacher-review-ticket';
import type { TeacherReviewTicketRepository } from '@/domain/ports/teacher-review-ticket-repository';
import { TicketNotFoundError } from '@/domain/ports/teacher-review-ticket-repository';

type PrismaTicket = NonNullable<Awaited<ReturnType<typeof prisma.teacherReviewTicket.findUnique>>>;

const mapTicketToDomain = (entity: PrismaTicket): TeacherReviewTicket => {
  const snapshot = (entity.snapshot ?? {}) as Record<string, any>;

  return {
    id: entity.id,
    sessionId: entity.sessionId,
    studentId: entity.studentId,
    status: entity.status as TicketStatus,
    reason: entity.reason as any,
    snapshot: {
      sessionCheckpoint: (snapshot.sessionCheckpoint ?? {}) as Record<string, unknown>,
      interactions: (snapshot.interactions ?? []) as Array<{
        turnNumber: number;
        transcript: string;
        aiResponse: string | null;
      }>,
      failedAnswer: snapshot.failedAnswer as string,
      citations: (snapshot.citations ?? []) as string[],
    },
    teacherNotes: entity.teacherNotes,
    createdAt: entity.createdAt,
    resolvedAt: entity.resolvedAt,
    updatedAt: entity.updatedAt,
  };
};

export class PrismaTeacherReviewTicketRepository implements TeacherReviewTicketRepository {
  async findById(id: string): Promise<TeacherReviewTicket | null> {
    const ticket = await prisma.teacherReviewTicket.findUnique({ where: { id } });
    return ticket ? mapTicketToDomain(ticket) : null;
  }

  async findBySessionId(sessionId: string): Promise<TeacherReviewTicket | null> {
    const ticket = await prisma.teacherReviewTicket.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    return ticket ? mapTicketToDomain(ticket) : null;
  }

  async findByStudentId(studentId: string): Promise<TeacherReviewTicket[]> {
    const tickets = await prisma.teacherReviewTicket.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    return tickets.map(mapTicketToDomain);
  }

  async findByStatus(status: TicketStatus): Promise<TeacherReviewTicket[]> {
    const tickets = await prisma.teacherReviewTicket.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });
    return tickets.map(mapTicketToDomain);
  }

  async findPending(): Promise<TeacherReviewTicket[]> {
    return this.findByStatus('PENDING');
  }

  async create(
    ticket: Omit<TeacherReviewTicket, 'createdAt' | 'updatedAt' | 'resolvedAt'>,
  ): Promise<TeacherReviewTicket> {
    const created = await prisma.teacherReviewTicket.create({
      data: {
        id: ticket.id,
        sessionId: ticket.sessionId,
        studentId: ticket.studentId,
        status: 'PENDING',
        reason: ticket.reason as unknown as any,
        snapshot: ticket.snapshot as unknown as any,
        teacherNotes: null,
      },
    });
    return mapTicketToDomain(created);
  }

  async updateStatus(ticketId: string, status: TicketStatus): Promise<TeacherReviewTicket> {
    try {
      const isResolved = status === 'RESOLVED' || status === 'DISMISSED';
      const updated = await prisma.teacherReviewTicket.update({
        where: { id: ticketId },
        data: {
          status,
          resolvedAt: isResolved ? new Date() : null,
        },
      });
      return mapTicketToDomain(updated);
    } catch (error) {
      handlePrismaError(error, TicketNotFoundError, ticketId);
    }
  }

  async addTeacherNotes(ticketId: string, notes: string): Promise<TeacherReviewTicket> {
    try {
      const updated = await prisma.teacherReviewTicket.update({
        where: { id: ticketId },
        data: { teacherNotes: notes },
      });
      return mapTicketToDomain(updated);
    } catch (error) {
      handlePrismaError(error, TicketNotFoundError, ticketId);
    }
  }
}
