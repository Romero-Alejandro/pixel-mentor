export interface ActivityAttempt {
  readonly id: string;
  readonly userId: string;
  readonly atomId: string;
  readonly atomOptionId?: string;
  readonly attemptNo: number;
  readonly response?: unknown;
  readonly correct?: boolean;
  /** Fase 2: partial score 0..1 (multi-answer formats); undefined for binary. */
  readonly score?: number;
  readonly elapsedMs?: number;
  readonly hintUsed: number;
  readonly meta?: unknown;
  readonly createdAt: Date;
  /** Fase 2: plugin format of the graded step, mirrored from meta.format. */
  readonly format?: string;
  // Optional relations for optimized queries (N+1 prevention)
  readonly atom?: {
    readonly id: string;
    readonly type: string;
    readonly content?: unknown;
    readonly options?: readonly {
      readonly id: string;
      readonly text: string;
      readonly isCorrect: boolean;
    }[];
  };
  readonly atomOption?: {
    readonly id: string;
    readonly text: string;
    readonly isCorrect: boolean;
  };
}

export function createActivityAttempt(parameters: {
  id: string;
  userId: string;
  atomId: string;
  attemptNo?: number;
  atomOptionId?: string;
  response?: unknown;
  correct?: boolean;
  score?: number;
  elapsedMs?: number;
  hintUsed?: number;
  meta?: unknown;
  format?: string;
}): ActivityAttempt {
  return {
    id: parameters.id,
    userId: parameters.userId,
    atomId: parameters.atomId,
    atomOptionId: parameters.atomOptionId,
    attemptNo: parameters.attemptNo ?? 1,
    response: parameters.response,
    correct: parameters.correct,
    elapsedMs: parameters.elapsedMs,
    hintUsed: parameters.hintUsed ?? 0,
    meta: parameters.meta,
    ...(parameters.format !== undefined ? { format: parameters.format } : {}),
    createdAt: new Date(),
  };
}
