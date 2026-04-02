import { prisma } from '@/database/client';

import type { Interaction } from '@/features/session/domain/entities/interaction.entity';
import type { AIResponse } from '@/features/recipe/domain/ports/ai-service.port';
import type { InteractionRepository } from '@/features/session/domain/ports/interaction.repository.port';

export class PrismaInteractionRepository implements InteractionRepository {
  private mapToDomain(prismaEntity: Record<string, unknown>): Interaction {
    return {
      id: prismaEntity.id as string,
      sessionId: prismaEntity.sessionId as string,
      turnNumber: prismaEntity.turnNumber as number,
      transcript: prismaEntity.transcript as string,
      aiResponse: prismaEntity.aiResponse,
      comprehensionConfirmed: prismaEntity.comprehensionConfirmed as boolean,
      questionAsked: prismaEntity.questionAsked as boolean,
      pausedForQuestion: prismaEntity.pausedForQuestion as boolean,
      flaggedForReview: prismaEntity.flaggedForReview as boolean,
      createdAt: prismaEntity.createdAt as Date,
      updatedAt: prismaEntity.updatedAt as Date,
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
    return this.findBySession(sessionId);
  }

  async create(
    interaction: Omit<
      Interaction,
      'createdAt' | 'updatedAt' | 'comprehensionConfirmed' | 'flaggedForReview' | 'questionAsked'
    >,
  ): Promise<Interaction> {
    const created = await prisma.interaction.upsert({
      where: {
        sessionId_turnNumber: {
          sessionId: interaction.sessionId,
          turnNumber: interaction.turnNumber,
        },
      },
      update: {
        transcript: interaction.transcript,
        aiResponse: interaction.aiResponse as never,
        pausedForQuestion: interaction.pausedForQuestion,
      },
      create: {
        sessionId: interaction.sessionId,
        turnNumber: interaction.turnNumber,
        transcript: interaction.transcript,
        aiResponse: interaction.aiResponse as never,
        comprehensionConfirmed: false,
        questionAsked: false,
        pausedForQuestion: interaction.pausedForQuestion ?? false,
        flaggedForReview: false,
      },
    });
    return this.mapToDomain(created);
  }

  async addAIResponse(interactionId: string, aiResponse: AIResponse): Promise<Interaction> {
    const updated = await prisma.interaction.update({
      where: { id: interactionId },
      data: { aiResponse: aiResponse as never },
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
