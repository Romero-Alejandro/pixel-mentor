import { prisma } from '../client.js';

import type { Interaction } from '@/domain/entities/interaction.js';
import type { AIResponse } from '@/domain/ports/ai-service.js';
import { type InteractionRepository } from '@/domain/ports/interaction-repository.js';

export class PrismaInteractionRepository implements InteractionRepository {
  private mapToDomain(prismaEntity: any): Interaction {
    return {
      id: prismaEntity.id,
      sessionId: prismaEntity.sessionId,
      turnNumber: prismaEntity.turnNumber,
      transcript: prismaEntity.transcript,
      aiResponse: prismaEntity.aiResponse,
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
    return interactions.map(this.mapToDomain);
  }

  async findBySessionOrdered(sessionId: string): Promise<Interaction[]> {
    // Same as findBySession but explicitly ordered
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
        sessionId: interaction.sessionId,
        turnNumber: interaction.turnNumber,
        transcript: interaction.transcript,
        aiResponse: interaction.aiResponse,
        comprehensionConfirmed: false,
        questionAsked: false,
        pausedForQuestion: false,
        flaggedForReview: false,
      },
    });
    return this.mapToDomain(created);
  }

  async addAIResponse(interactionId: string, aiResponse: AIResponse): Promise<Interaction> {
    const updated = await prisma.interaction.update({
      where: { id: interactionId },
      data: { aiResponse: aiResponse as any },
    });
    return this.mapToDomain(updated);
  }

  async confirmComprehension(interactionId: string): Promise<Interaction> {
    const updated = await prisma.interaction.update({
      where: { id: interactionId },
      data: { comprehensionConfirmed: true },
    });
    return this.mapToDomain(updated);
  }

  async flagForReview(interactionId: string): Promise<Interaction> {
    const updated = await prisma.interaction.update({
      where: { id: interactionId },
      data: { flaggedForReview: true },
    });
    return this.mapToDomain(updated);
  }

  async markAsQuestion(interactionId: string): Promise<Interaction> {
    const updated = await prisma.interaction.update({
      where: { id: interactionId },
      data: { questionAsked: true },
    });
    return this.mapToDomain(updated);
  }

  async getLatestBySession(sessionId: string): Promise<Interaction | null> {
    const interaction = await prisma.interaction.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    return interaction ? this.mapToDomain(interaction) : null;
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await prisma.interaction.deleteMany({ where: { sessionId } });
  }
}
