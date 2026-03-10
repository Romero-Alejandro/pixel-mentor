import type { TeacherReviewTicket, TicketStatus } from '@/domain/entities/teacher-review-ticket';

export interface TeacherReviewTicketRepository {
  findById(id: string): Promise<TeacherReviewTicket | null>;

  findBySessionId(sessionId: string): Promise<TeacherReviewTicket | null>;

  findByStudentId(studentId: string): Promise<TeacherReviewTicket[]>;

  findByStatus(status: TicketStatus): Promise<TeacherReviewTicket[]>;

  findPending(): Promise<TeacherReviewTicket[]>;

  create(
    ticket: Omit<TeacherReviewTicket, 'createdAt' | 'updatedAt' | 'resolvedAt'>,
  ): Promise<TeacherReviewTicket>;

  updateStatus(ticketId: string, status: TicketStatus): Promise<TeacherReviewTicket>;

  addTeacherNotes(ticketId: string, notes: string): Promise<TeacherReviewTicket>;
}

export class TicketNotFoundError extends Error {
  readonly code = 'TICKET_NOT_FOUND' as const;
  readonly ticketId: string;

  constructor(ticketId: string) {
    super(`Teacher review ticket with ID ${ticketId} not found`);
    this.name = 'TicketNotFoundError';
    this.ticketId = ticketId;
  }
}
