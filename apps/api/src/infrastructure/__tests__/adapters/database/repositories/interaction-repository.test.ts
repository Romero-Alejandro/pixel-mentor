import { randomUUID } from 'node:crypto';

import { PrismaInteractionRepository } from '@/infrastructure/adapters/database/repositories/interaction-repository';
import type { AIResponseMetadata } from '@/domain/entities/interaction';

// Mock the actual file that the repository imports
jest.mock('@/infrastructure/adapters/database/client');

// Import the mocked module
import { prisma } from '@/infrastructure/adapters/database/client';

describe('PrismaInteractionRepository', () => {
  let repository: PrismaInteractionRepository;

  beforeEach(() => {
    repository = new PrismaInteractionRepository();
    jest.clearAllMocks();
  });

  const mockInteraction = {
    id: randomUUID(),
    sessionId: randomUUID(),
    turnNumber: 1,
    transcript: 'Hello tutor',
    aiResponse: { text: 'Hi there!', responseType: 'explanation' } as AIResponseMetadata,
    comprehensionConfirmed: false,
    questionAsked: false,
    pausedForQuestion: false,
    flaggedForReview: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('findById', () => {
    it('should return interaction when found', async () => {
      (prisma.interaction.findUnique as jest.Mock).mockResolvedValueOnce(mockInteraction);

      const result = await repository.findById(mockInteraction.id);

      expect(prisma.interaction.findUnique).toHaveBeenCalledWith({
        where: { id: mockInteraction.id },
      });
      expect(result?.id).toBe(mockInteraction.id);
    });

    it('should return null when not found', async () => {
      (prisma.interaction.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findBySession', () => {
    it('should return interactions for session', async () => {
      (prisma.interaction.findMany as jest.Mock).mockResolvedValueOnce([mockInteraction]);

      const result = await repository.findBySession(mockInteraction.sessionId);

      expect(prisma.interaction.findMany).toHaveBeenCalledWith({
        where: { sessionId: mockInteraction.sessionId },
        orderBy: { turnNumber: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].turnNumber).toBe(1);
    });
  });

  describe('findBySessionOrdered', () => {
    it('should delegate to findBySession', async () => {
      (prisma.interaction.findMany as jest.Mock).mockResolvedValueOnce([mockInteraction]);

      const result = await repository.findBySessionOrdered(mockInteraction.sessionId);

      expect(prisma.interaction.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should create a new interaction', async () => {
      const newInteractionData = {
        id: randomUUID(),
        sessionId: mockInteraction.sessionId,
        turnNumber: 1,
        transcript: 'Test input',
        aiResponse: null,
        pausedForQuestion: false,
      };

      (prisma.interaction.create as jest.Mock).mockResolvedValueOnce({
        ...newInteractionData,
        comprehensionConfirmed: false,
        flaggedForReview: false,
        questionAsked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repository.create(newInteractionData);

      expect(prisma.interaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: newInteractionData.id,
          sessionId: newInteractionData.sessionId,
          turnNumber: 1,
          transcript: 'Test input',
          pausedForQuestion: false,
          comprehensionConfirmed: false,
          flaggedForReview: false,
          questionAsked: false,
        }),
      });
      expect(result.id).toBe(newInteractionData.id);
    });
  });

  describe('addAIResponse', () => {
    it('should add AI response to interaction', async () => {
      const aiResponse: AIResponseMetadata = {
        text: 'AI response text',
        responseType: 'answer',
      };
      const updatedInteraction = { ...mockInteraction, aiResponse };

      (prisma.interaction.update as jest.Mock).mockResolvedValueOnce(updatedInteraction);

      const result = await repository.addAIResponse(mockInteraction.id, aiResponse);

      expect(prisma.interaction.update).toHaveBeenCalledWith({
        where: { id: mockInteraction.id },
        data: { aiResponse: aiResponse as object },
      });
      expect(result.aiResponse).toEqual(aiResponse);
    });

    it('should throw InteractionNotFoundError if interaction not found', async () => {
      (prisma.interaction.update as jest.Mock).mockRejectedValueOnce(new Error());

      await expect(
        repository.addAIResponse('non-existent-id', {} as AIResponseMetadata),
      ).rejects.toThrow('Interaction with ID non-existent-id not found');
    });
  });

  describe('confirmComprehension', () => {
    it('should mark comprehension as confirmed', async () => {
      const updatedInteraction = { ...mockInteraction, comprehensionConfirmed: true };
      (prisma.interaction.update as jest.Mock).mockResolvedValueOnce(updatedInteraction);

      const result = await repository.confirmComprehension(mockInteraction.id);

      expect(prisma.interaction.update).toHaveBeenCalledWith({
        where: { id: mockInteraction.id },
        data: { comprehensionConfirmed: true },
      });
      expect(result.comprehensionConfirmed).toBe(true);
    });
  });

  describe('flagForReview', () => {
    it('should flag interaction for review', async () => {
      const updatedInteraction = { ...mockInteraction, flaggedForReview: true };
      (prisma.interaction.update as jest.Mock).mockResolvedValueOnce(updatedInteraction);

      const result = await repository.flagForReview(mockInteraction.id);

      expect(prisma.interaction.update).toHaveBeenCalledWith({
        where: { id: mockInteraction.id },
        data: { flaggedForReview: true },
      });
      expect(result.flaggedForReview).toBe(true);
    });
  });

  describe('markAsQuestion', () => {
    it('should mark interaction as question', async () => {
      const updatedInteraction = { ...mockInteraction, questionAsked: true };
      (prisma.interaction.update as jest.Mock).mockResolvedValueOnce(updatedInteraction);

      const result = await repository.markAsQuestion(mockInteraction.id);

      expect(prisma.interaction.update).toHaveBeenCalledWith({
        where: { id: mockInteraction.id },
        data: { questionAsked: true },
      });
      expect(result.questionAsked).toBe(true);
    });
  });

  describe('getLatestBySession', () => {
    it('should return latest interaction for session', async () => {
      (prisma.interaction.findFirst as jest.Mock).mockResolvedValueOnce(mockInteraction);

      const result = await repository.getLatestBySession(mockInteraction.sessionId);

      expect(prisma.interaction.findFirst).toHaveBeenCalledWith({
        where: { sessionId: mockInteraction.sessionId },
        orderBy: { turnNumber: 'desc' },
      });
      expect(result?.id).toBe(mockInteraction.id);
    });

    it('should return null if no interactions found', async () => {
      (prisma.interaction.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.getLatestBySession('session-without-interactions');

      expect(result).toBeNull();
    });
  });
});
