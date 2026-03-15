// Activity: A pedagogical activity within a concept

export type ActivityType = 'PRACTICE' | 'QUIZ' | 'GAME';

export interface ActivityOption {
  readonly text: string;
  readonly isCorrect: boolean;
}

export interface ActivityFeedback {
  readonly correct: string;
  readonly incorrect: string;
  readonly partial?: string;
}

export interface Activity {
  readonly id: string;
  readonly conceptId: string;
  readonly type: ActivityType;
  readonly order: number;
  readonly instruction: string;
  readonly options: readonly ActivityOption[] | null;
  readonly correctAnswer: string;
  readonly feedback: ActivityFeedback;
  readonly createdAt: Date;
}

export function createActivity(parameters: {
  id: string;
  conceptId: string;
  type: ActivityType;
  order: number;
  instruction: string;
  options?: readonly ActivityOption[] | null;
  correctAnswer: string;
  feedback: ActivityFeedback;
}): Activity {
  return {
    id: parameters.id,
    conceptId: parameters.conceptId,
    type: parameters.type,
    order: parameters.order,
    instruction: parameters.instruction,
    options: parameters.options ? Object.freeze([...parameters.options]) : null,
    correctAnswer: parameters.correctAnswer,
    feedback: parameters.feedback,
    createdAt: new Date(),
  };
}
