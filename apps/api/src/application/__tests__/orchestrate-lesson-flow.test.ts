import { randomUUID } from 'node:crypto';
import { OrchestrateLessonUseCase } from '@/application/use-cases/orchestrate-lesson.use-case';
import type { SessionRepository } from '@/domain/ports/session-repository';
import type { InteractionRepository } from '@/domain/ports/interaction-repository';
import type { LessonRepository } from '@/domain/ports/lesson-repository';
import type { AIService } from '@/domain/ports/ai-service';
import { LessonNotFoundError } from '@/domain/ports/lesson-repository';
import { SessionNotFoundError, ActiveSessionExistsError } from '@/domain/ports/session-repository';
import { createLesson } from '@/domain/entities/lesson';
import type { Session } from '@/domain/entities/session';
import { createSession } from '@/domain/entities/session';

describe('OrchestrateLessonUseCase - Full Flow', () => {
  let useCase: OrchestrateLessonUseCase;
  let mockSessionRepo: jest.Mocked<SessionRepository>;
  let mockInteractionRepo: jest.Mocked<InteractionRepository>;
  let mockLessonRepo: jest.Mocked<LessonRepository>;
  let mockAiService: jest.Mocked<AIService>;

  const testLessonId = randomUUID();
  const testStudentId = randomUUID();

  const testLesson = createLesson({
    id: testLessonId,
    title: 'Math 101',
    description: 'Basic math concepts',
    concepts: [{ id: randomUUID(), title: 'Addition', description: 'Adding numbers' }],
    analogies: [],
    commonErrors: [],
    baseExplanation: 'Base explanation',
    questions: [
      {
        id: randomUUID(),
        lessonId: testLessonId,
        text: 'What is 2 + 2?',
        expectedAnswer: '4',
        order: 0,
      },
    ],
    chunks: [],
    active: true,
  });

  const mockAiResponse = {
    voiceText: 'Hello, let me explain!',
    pedagogicalState: 'EXPLANATION' as const,
  };

  beforeEach(() => {
    mockSessionRepo = {
      findById: jest.fn(),
      findByStudentAndLesson: jest.fn(),
      findByStudent: jest.fn(),
      findActiveByStudent: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      updateCheckpoint: jest.fn(),
      setCurrentInteraction: jest.fn(),
      complete: jest.fn(),
      escalate: jest.fn(),
      incrementVersion: jest.fn(),
    };

    mockInteractionRepo = {
      findById: jest.fn(),
      findBySession: jest.fn(),
      findBySessionOrdered: jest.fn(),
      create: jest.fn(),
      addAIResponse: jest.fn(),
      confirmComprehension: jest.fn(),
      flagForReview: jest.fn(),
      markAsQuestion: jest.fn(),
      getLatestBySession: jest.fn(),
    };

    mockLessonRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findChunksByLessonId: jest.fn(),
      createChunk: jest.fn(),
      updateChunkEmbedding: jest.fn(),
      findRelevantChunks: jest.fn(),
    };

    mockAiService = {
      generateResponse: jest.fn(),
      generateExplanation: jest.fn(),
      evaluateResponse: jest.fn(),
      classifyQuestion: jest.fn(),
      evaluateComprehension: jest.fn(),
    };

    useCase = new OrchestrateLessonUseCase(
      mockSessionRepo,
      mockInteractionRepo,
      mockLessonRepo,
      mockAiService,
    );
  });

  describe('start()', () => {
    it('should start a lesson successfully', async () => {
      mockLessonRepo.findById.mockResolvedValueOnce(testLesson);
      mockSessionRepo.findByStudentAndLesson.mockResolvedValueOnce(null);
      mockAiService.generateResponse.mockResolvedValueOnce(mockAiResponse);

      const result = await useCase.start(testLessonId, testStudentId);

      expect(mockLessonRepo.findById).toHaveBeenCalledWith(testLessonId);
      expect(mockSessionRepo.findByStudentAndLesson).toHaveBeenCalledWith(
        testStudentId,
        testLessonId,
      );
      expect(mockSessionRepo.create).toHaveBeenCalled();
      expect(mockAiService.generateResponse).toHaveBeenCalledWith({
        lesson: testLesson,
        currentState: 'EXPLANATION',
        conversationHistory: [],
      });
      expect(mockSessionRepo.setCurrentInteraction).toHaveBeenCalled();
      expect(mockSessionRepo.updateStatus).toHaveBeenCalledWith(expect.any(String), 'active');
      expect(result.sessionId).toBeDefined();
      expect(result.voiceText).toBe('Hello, let me explain!');
      expect(result.pedagogicalState).toBe('EXPLANATION');
    });

    it('should throw LessonNotFoundError if lesson does not exist', async () => {
      mockLessonRepo.findById.mockResolvedValueOnce(null);

      await expect(useCase.start(testLessonId, testStudentId)).rejects.toThrow(LessonNotFoundError);
    });

    it('should throw ActiveSessionExistsError if active session exists', async () => {
      mockLessonRepo.findById.mockResolvedValueOnce(testLesson);

      const existingSession = {
        ...createSession({
          id: randomUUID(),
          studentId: testStudentId,
          lessonId: testLessonId,
        }),
        status: 'active' as const,
      };
      mockSessionRepo.findByStudentAndLesson.mockResolvedValueOnce(existingSession);

      await expect(useCase.start(testLessonId, testStudentId)).rejects.toThrow(
        ActiveSessionExistsError,
      );
    });
  });

  describe('interact()', () => {
    let sessionId: string;

    beforeEach(() => {
      sessionId = randomUUID();
    });

    it('should handle interaction successfully and complete session', async () => {
      const session: Session = {
        ...createSession({ id: sessionId, studentId: testStudentId, lessonId: testLessonId }),
        status: 'active',
        stateCheckpoint: { currentState: 'EVALUATION', currentQuestionIndex: 0 },
      };
      mockSessionRepo.findById.mockResolvedValueOnce(session);
      mockLessonRepo.findById.mockResolvedValueOnce(testLesson);
      mockInteractionRepo.findBySessionOrdered.mockResolvedValueOnce([]);
      mockAiService.generateResponse.mockResolvedValueOnce({
        voiceText: 'Correct!',
        pedagogicalState: 'EVALUATION',
        isCorrect: true,
      });

      const result = await useCase.interact(sessionId, '4');

      expect(mockSessionRepo.findById).toHaveBeenCalledWith(sessionId);
      expect(mockLessonRepo.findById).toHaveBeenCalledWith(session.lessonId);
      expect(mockInteractionRepo.findBySessionOrdered).toHaveBeenCalledWith(sessionId);
      expect(mockAiService.generateResponse).toHaveBeenCalled();
      expect(mockInteractionRepo.create).toHaveBeenCalledTimes(2);
      expect(mockSessionRepo.complete).toHaveBeenCalled();
      expect(result.sessionCompleted).toBe(true);
      expect(result.pedagogicalState).toBe('EVALUATION');
      expect(result.isCorrect).toBe(true);
    });

    it('should update checkpoint and continue if not completed', async () => {
      const session: Session = {
        ...createSession({ id: sessionId, studentId: testStudentId, lessonId: testLessonId }),
        status: 'active',
        stateCheckpoint: { currentState: 'EXPLANATION', currentQuestionIndex: 0 },
      };
      mockSessionRepo.findById.mockResolvedValueOnce(session);
      mockLessonRepo.findById.mockResolvedValueOnce(testLesson);
      mockInteractionRepo.findBySessionOrdered.mockResolvedValueOnce([]);
      mockAiService.generateResponse.mockResolvedValueOnce({
        voiceText: 'What is 2 + 2?',
        pedagogicalState: 'QUESTION',
      });

      const result = await useCase.interact(sessionId, 'answer');

      expect(mockSessionRepo.complete).not.toHaveBeenCalled();
      expect(mockSessionRepo.updateCheckpoint).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          currentState: 'QUESTION',
          currentQuestionIndex: 1,
        }),
      );
      expect(result.sessionCompleted).toBe(false);
    });

    it('should throw SessionNotFoundError if session does not exist', async () => {
      mockSessionRepo.findById.mockResolvedValueOnce(null);

      await expect(useCase.interact(sessionId, 'test')).rejects.toThrow(SessionNotFoundError);
    });

    it('should throw error if session is not active', async () => {
      const session: Session = {
        ...createSession({ id: sessionId, studentId: testStudentId, lessonId: testLessonId }),
        status: 'completed',
      };
      mockSessionRepo.findById.mockResolvedValueOnce(session);

      await expect(useCase.interact(sessionId, 'test')).rejects.toThrow('Session is not active');
    });

    it('should throw LessonNotFoundError if lesson not found during interact', async () => {
      const session: Session = {
        ...createSession({ id: sessionId, studentId: testStudentId, lessonId: testLessonId }),
        status: 'active',
      };
      mockSessionRepo.findById.mockResolvedValueOnce(session);
      mockLessonRepo.findById.mockResolvedValueOnce(null);

      await expect(useCase.interact(sessionId, 'test')).rejects.toThrow(LessonNotFoundError);
    });
  });
});
