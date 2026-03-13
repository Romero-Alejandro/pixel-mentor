// Extracted from backend domain entities for type safety

export interface Concept {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly example?: string;
}

export interface Analogy {
  readonly id: string;
  readonly text: string;
  readonly sourceDomain: string;
  readonly targetDomain: string;
}

export interface CommonError {
  readonly id: string;
  readonly incorrectConcept: string;
  readonly correctionExplanation: string;
}

export interface Question {
  readonly id: string;
  readonly lessonId: string;
  readonly text: string;
  readonly expectedAnswer: string;
  readonly feedbackExplanation?: string;
  readonly multipleChoiceOptions?: readonly string[];
  readonly order: number;
}

export interface LessonChunk {
  readonly id: string;
  readonly lessonId: string;
  readonly index: number;
  readonly order: number;
  readonly chunkText: string;
  readonly embedding: number[] | null;
  readonly version: number;
  readonly isImmutable: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly concepts: readonly Concept[];
  readonly analogies: readonly Analogy[];
  readonly commonErrors: readonly CommonError[];
  readonly baseExplanation: string;
  readonly questions: readonly Question[];
  readonly chunks: readonly LessonChunk[];
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SessionCheckpoint {
  readonly currentState: PedagogicalState;
  readonly currentSegmentIndex: number;
  readonly currentQuestionIndex: number;
  readonly savedSegmentIndex?: number;
  readonly doubtContext?: {
    readonly question: string;
    readonly chunkIndex: number;
  };
}

export type SessionStatus =
  | 'idle'
  | 'active'
  | 'paused_for_question'
  | 'awaiting_confirmation'
  | 'paused_idle'
  | 'completed'
  | 'escalated';

export interface Session {
  readonly id: string;
  readonly studentId: string;
  readonly lessonId: string;
  readonly status: SessionStatus;
  readonly stateCheckpoint: SessionCheckpoint;
  readonly currentInteractionId: string | null;
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
  readonly completedAt: Date | null;
  readonly escalatedAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly safetyFlag?: string | null;
  readonly outOfScope?: boolean;
  readonly failedAttempts?: number;
}

export type PedagogicalState =
  | 'ACTIVE_CLASS'
  | 'RESOLVING_DOUBT'
  | 'CLARIFYING'
  | 'QUESTION'
  | 'EVALUATION'
  | 'COMPLETED'
  | 'EXPLANATION';

export interface Message {
  readonly role: 'tutor' | 'student';
  readonly text: string;
}

export interface MissionReportStats {
  readonly xpEarned: number;
  readonly accuracy: number;
  readonly conceptsMastered: readonly string[];
}
