export interface Interaction {
  readonly id: string;
  readonly sessionId: string;
  readonly turnNumber: number;
  readonly transcript: string;
  readonly aiResponse?: unknown;
  readonly comprehensionConfirmed: boolean;
  readonly questionAsked: boolean;
  readonly pausedForQuestion: boolean;
  readonly flaggedForReview: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createInteraction(parameters: {
  id: string;
  sessionId: string;
  turnNumber: number;
  transcript: string;
  aiResponse?: unknown;
  questionAsked?: boolean;
  pausedForQuestion?: boolean;
}): Interaction {
  const now = new Date();
  return {
    id: parameters.id,
    sessionId: parameters.sessionId,
    turnNumber: parameters.turnNumber,
    transcript: parameters.transcript,
    aiResponse: parameters.aiResponse,
    comprehensionConfirmed: false,
    questionAsked: parameters.questionAsked ?? false,
    pausedForQuestion: parameters.pausedForQuestion ?? false,
    flaggedForReview: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function setAIResponse(interaction: Interaction, aiResponse: unknown): Interaction {
  return { ...interaction, aiResponse, updatedAt: new Date() };
}

export function confirmComprehension(interaction: Interaction): Interaction {
  return { ...interaction, comprehensionConfirmed: true, updatedAt: new Date() };
}

export function flagForReview(interaction: Interaction): Interaction {
  return { ...interaction, flaggedForReview: true, updatedAt: new Date() };
}

export function markAsQuestion(interaction: Interaction): Interaction {
  return { ...interaction, questionAsked: true, updatedAt: new Date() };
}
