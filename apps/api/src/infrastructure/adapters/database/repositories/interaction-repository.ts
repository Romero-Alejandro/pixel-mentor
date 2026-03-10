import { prisma } from '../client.js';

import type { AIResponseMetadata, Interaction } from '@/domain/entities/interaction.js';
import {
  InteractionNotFoundError,
  type InteractionRepository,
} from '@/domain/ports/interaction-repository.js';

interface DomainInteraction {
  readonly id: string;
  readonly sessionId: string;
  readonly turnNumber: number;
  readonly transcript: string;
  readonly aiResponse: AIResponseMetadata | null;
  readonly comprehensionConfirmed: boolean;
  readonly questionAsked: boolean;
  readonly pausedForQuestion: boolean;
  readonly flaggedForReview: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class PrismaInteractionRepository implements InteractionRepository {
  private mapToDomain(prismaEntity: any): DomainInteraction {
    return {
      id: prismaEntity.id,
      sessionId: prismaEntity.sessionId,
      turnNumber: prismaEntity.turnNumber,
      transcript: prismaEntity.transcript,
      aiResponse: prismaEntity.aiResponse as AIResponseMetadata | null,
      comprehensionConfirmed: prismaEntity.comprehensionConfirmed,
      questionAsked: prismaEntity.questionAsked,
      pausedForQuestion: prismaEntity.pausedForQuestion,
      flaggedForReview: prismaEntity.flaggedForReview,
      createdAt: prismaEntity.createdAt,
      updatedAt: prismaEntity.updatedAt,
    };
  }

  async findById(id: string): Promise<Interaction | null> {
    const interaction = await prisma.interaction.findUnique({ where: { id } });
    return interaction ? this.mapToDomain(interaction) : null;
  }

  async findBySession(sessionId: string): Promise<Interaction[]> {
    const interactions = await prisma.interaction.findMany({
      where: { sessionId },
      orderBy: { turnNumber: 'asc' },
    });
    return interactions.map((entity: any) => this.mapToDomain(entity));
  }

  async findBySessionOrdered(sessionId: string): Promise<Interaction[]> {
    return this.findBySession(sessionId);
  }

  async create(
    interaction: Omit<
      Interaction,
      'createdAt' | 'updatedAt' | 'comprehensionConfirmed' | 'flaggedForReview' | 'questionAsked'
    >,
  ): Promise<Interaction> {
    const created = await prisma.interaction.create({
      data: {
        id: interaction.id,
        sessionId: interaction.sessionId,
        turnNumber: interaction.turnNumber,
        transcript: interaction.transcript,
        aiResponse: interaction.aiResponse as unknown as any,
        pausedForQuestion: interaction.pausedForQuestion,
        comprehensionConfirmed: false,
        flaggedForReview: false,
        questionAsked: false,
      },
    });
    return this.mapToDomain(created);
  }

  async addAIResponse(interactionId: string, aiResponse: AIResponseMetadata): Promise<Interaction> {
    try {
      const updated = await prisma.interaction.update({
        where: { id: interactionId },
        data: {
          aiResponse: aiResponse as object,
        },
      });
      return this.mapToDomain(updated);
    } catch {
      throw new InteractionNotFoundError(interactionId);
    }
  }

  async confirmComprehension(interactionId: string): Promise<Interaction> {
    try {
      const updated = await prisma.interaction.update({
        where: { id: interactionId },
        data: { comprehensionConfirmed: true },
      });
      return this.mapToDomain(updated);
    } catch {
      throw new InteractionNotFoundError(interactionId);
    }
  }

  async flagForReview(interactionId: string): Promise<Interaction> {
    try {
      const updated = await prisma.interaction.update({
        where: { id: interactionId },
        data: { flaggedForReview: true },
      });
      return this.mapToDomain(updated);
    } catch {
      throw new InteractionNotFoundError(interactionId);
    }
  }

  async markAsQuestion(interactionId: string): Promise<Interaction> {
    try {
      const updated = await prisma.interaction.update({
        where: { id: interactionId },
        data: { questionAsked: true },
      });
      return this.mapToDomain(updated);
    } catch {
      throw new InteractionNotFoundError(interactionId);
    }
  }

  async getLatestBySession(sessionId: string): Promise<Interaction | null> {
    const interaction = await prisma.interaction.findFirst({
      where: { sessionId },
      orderBy: { turnNumber: 'desc' },
    });
    return interaction ? this.mapToDomain(interaction) : null;
  }
}
