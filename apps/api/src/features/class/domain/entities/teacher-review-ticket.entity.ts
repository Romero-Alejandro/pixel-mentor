export type TicketStatus = 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';

export type EscalationReason =
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'SAFETY_FLAG'
  | 'OUT_OF_SCOPE'
  | 'CRITICAL_VALIDATION_ERROR';

export interface TeacherReviewTicket {
  readonly id: string;
  readonly sessionId: string;
  readonly studentId: string;
  readonly status: TicketStatus;
  readonly reason: EscalationReason;
  readonly snapshot: {
    readonly sessionCheckpoint: Record<string, unknown>;
    readonly interactions: readonly {
      readonly turnNumber: number;
      readonly transcript: string;
      readonly aiResponse: string | null;
    }[];
    readonly failedAnswer: string;
    readonly citations: readonly string[];
  };
  readonly teacherNotes: string | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
  readonly updatedAt: Date;
}

export function createTeacherReviewTicket(parameters: {
  id: string;
  sessionId: string;
  studentId: string;
  reason: EscalationReason;
  snapshot: TeacherReviewTicket['snapshot'];
}): TeacherReviewTicket {
  const now = new Date();
  return {
    id: parameters.id,
    sessionId: parameters.sessionId,
    studentId: parameters.studentId,
    status: 'PENDING',
    reason: parameters.reason,
    snapshot: parameters.snapshot,
    teacherNotes: null,
    createdAt: now,
    resolvedAt: null,
    updatedAt: now,
  };
}

export function startReview(ticket: TeacherReviewTicket): TeacherReviewTicket {
  return {
    ...ticket,
    status: 'IN_REVIEW',
    updatedAt: new Date(),
  };
}

export function resolveTicket(ticket: TeacherReviewTicket, notes: string): TeacherReviewTicket {
  return {
    ...ticket,
    status: 'RESOLVED',
    teacherNotes: notes,
    resolvedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function dismissTicket(ticket: TeacherReviewTicket, notes: string): TeacherReviewTicket {
  return {
    ...ticket,
    status: 'DISMISSED',
    teacherNotes: notes,
    resolvedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function isEscalationRequired(parameters: {
  failedAttempts: number;
  hasSafetyFlag: boolean;
  isOutOfScope: boolean;
  hasCriticalValidationError: boolean;
  maxAttempts?: number;
}): EscalationReason | null {
  const maxAttempts = parameters.maxAttempts ?? 2;

  if (parameters.hasSafetyFlag) return 'SAFETY_FLAG';
  if (parameters.isOutOfScope) return 'OUT_OF_SCOPE';
  if (parameters.hasCriticalValidationError) return 'CRITICAL_VALIDATION_ERROR';
  if (parameters.failedAttempts > maxAttempts) return 'MAX_ATTEMPTS_EXCEEDED';

  return null;
}
