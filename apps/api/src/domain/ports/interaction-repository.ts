import type { Interaction } from '@/domain/entities/interaction.js';

export interface InteractionRepository {
  findById(id: string): Promise<Interaction | null>;
  findBySession(sessionId: string): Promise<Interaction[]>;
  findBySessionOrdered(sessionId: string): Promise<Interaction[]>;
  create(
    interaction: Omit<
      Interaction,
      'createdAt' | 'updatedAt' | 'comprehensionConfirmed' | 'flaggedForReview' | 'questionAsked'
    >,
  ): Promise<Interaction>;
  addAIResponse(interactionId: string, aiResponse: any): Promise<Interaction>;
  confirmComprehension(interactionId: string): Promise<Interaction>;
  flagForReview(interactionId: string): Promise<Interaction>;
  markAsQuestion(interactionId: string): Promise<Interaction>;
  getLatestBySession(sessionId: string): Promise<Interaction | null>;
  deleteBySession(sessionId: string): Promise<void>;
}

export class InteractionNotFoundError extends Error {
  readonly code = 'INTERACTION_NOT_FOUND' as const;
  readonly interactionId: string;

  constructor(interactionId: string) {
    super(`Interaction with ID ${interactionId} not found`);
    this.name = 'InteractionNotFoundError';
    this.interactionId = interactionId;
  }
}
