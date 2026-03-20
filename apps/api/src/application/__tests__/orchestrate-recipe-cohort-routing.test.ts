import { randomUUID } from 'node:crypto';

import { OrchestrateRecipeUseCase } from '@/application/use-cases/orchestrate-recipe.use-case';
import type { SessionRepository } from '@/domain/ports/session-repository';
import type { InteractionRepository } from '@/domain/ports/interaction-repository';
import type { RecipeRepository } from '@/domain/ports/recipe-repository';
import type { AtomRepository } from '@/domain/ports/atom-repository';
import type { UserRepository } from '@/domain/ports/user-repository';
import type { AIService } from '@/domain/ports/ai-service';
import type {
  QuestionClassifier,
  ComprehensionEvaluator,
  ComprehensionEvaluation,
} from '@/domain/ports/question-classifier';
import type { RAGService } from '@/domain/ports/rag-service';
import { SessionNotFoundError } from '@/domain/ports/session-repository';
import type { Recipe, RecipeStep } from '@/domain/entities/recipe';
import type { Atom } from '@/domain/entities/atom';
import type { Session } from '@/domain/entities/session';
import { createSession } from '@/domain/entities/session';
import { DEFAULT_COHORT } from '@/domain/entities/user';
import type { LessonEvaluatorUseCase } from '@/evaluator/index';
import type { FeatureFlagService } from '@/config/evaluation-flags';

// Mock FeatureFlagService for testing
function createMockFeatureFlagService(): jest.Mocked<FeatureFlagService> {
  return {
    shouldUseNewEngine: jest.fn(),
    getConfig: jest.fn(),
    getCohortConfig: jest.fn(),
    isConditionalTemplatesEnabled: jest.fn(),
    isKeywordExtractionEnabled: jest.fn(),
    getMaxTemplateDepth: jest.fn(),
    getKeywordExtractionConfig: jest.fn(),
    isTemplateEngineEnabledForCohort: jest.fn(),
    getCohorts: jest.fn(),
  } as unknown as jest.Mocked<FeatureFlagService>;
}

// Mock LessonEvaluatorUseCase
function createMockLessonEvaluator(): jest.Mocked<LessonEvaluatorUseCase> {
  return {
    evaluate: jest.fn(),
  } as unknown as jest.Mocked<LessonEvaluatorUseCase>;
}

describe('OrchestrateRecipeUseCase - Cohort-Based Evaluation Routing', () => {
  let useCase: OrchestrateRecipeUseCase;
  let mockSessionRepo: jest.Mocked<SessionRepository>;
  let mockInteractionRepo: jest.Mocked<InteractionRepository>;
  let mockRecipeRepo: jest.Mocked<RecipeRepository>;
  let mockAtomRepo: jest.Mocked<AtomRepository>;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockAiService: jest.Mocked<AIService>;
  let mockQuestionClassifier: jest.Mocked<QuestionClassifier>;
  let mockRagService: jest.Mocked<RAGService>;
  let mockComprehensionEvaluator: jest.Mocked<ComprehensionEvaluator>;
  let mockLessonEvaluator: jest.Mocked<LessonEvaluatorUseCase>;
  let mockFeatureFlagService: jest.Mocked<FeatureFlagService>;

  const testRecipeId = randomUUID();
  const testStudentId = randomUUID();
  const testAtomId = randomUUID();
  const testStepId = randomUUID();
  const sessionId = randomUUID();

  const testAtom: Atom = {
    id: testAtomId,
    canonicalId: randomUUID(),
    title: 'Test Atom',
    description: undefined,
    type: 'MICROLECTURE' as any,
    locale: 'es-AR',
    difficulty: 1,
    version: '1.0.0',
    published: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    content: 'Test content',
    options: undefined,
    competencies: undefined,
    attachments: undefined,
    knowledgeChunks: undefined,
  };

  const questionScript = {
    question: 'What is 2 + 2?',
    expectedAnswer: '4',
    feedback: { correct: 'Correct!', incorrect: 'Try again' },
    hint: 'Think of addition',
    transition: 'Let me ask you a question:',
  };

  const testStep: RecipeStep = {
    id: testStepId,
    recipeId: testRecipeId,
    atomId: testAtomId,
    order: 0,
    createdAt: new Date(),
    script: questionScript,
    stepType: 'question',
  };

  const testRecipe: Recipe = {
    id: testRecipeId,
    canonicalId: randomUUID(),
    title: 'Test Recipe',
    description: 'Test description',
    version: '1.0.0',
    published: true,
    steps: [testStep],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseSession: Session = {
    ...createSession({
      id: sessionId,
      studentId: testStudentId,
      recipeId: testRecipeId,
    }),
    status: 'ACTIVE',
    stateCheckpoint: {
      currentState: 'ACTIVITY_WAIT',
      currentStepIndex: 0,
    },
  };

  beforeEach(() => {
    mockSessionRepo = {
      findById: jest.fn(),
      findByStudentAndRecipe: jest.fn(),
      findByStudent: jest.fn(),
      findActiveByStudent: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      updateCheckpoint: jest.fn(),
      complete: jest.fn(),
      escalate: jest.fn(),
      incrementFailedAttempts: jest.fn(),
    };

    mockInteractionRepo = {
      findById: jest.fn(),
      findBySession: jest.fn(),
      findBySessionOrdered: jest.fn(),
      create: jest.fn(),
    };

    mockRecipeRepo = {
      findById: jest.fn(),
      findStepsByRecipeId: jest.fn(),
    };

    mockAtomRepo = {
      findById: jest.fn(),
    };

    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      create: jest.fn(),
      updateRole: jest.fn(),
      delete: jest.fn(),
    };

    mockAiService = {
      generateResponse: jest.fn(),
      generateExplanation: jest.fn(),
      evaluateResponse: jest.fn(),
    };

    mockQuestionClassifier = {
      classify: jest.fn().mockResolvedValue({ intent: 'answer', confidence: 0.5 }),
    };

    mockRagService = {
      retrieveChunks: jest.fn(),
    };

    mockComprehensionEvaluator = {
      evaluate: jest.fn(),
    };

    mockLessonEvaluator = createMockLessonEvaluator();
    mockFeatureFlagService = createMockFeatureFlagService();

    // Default mock for user repo
    mockUserRepo.findById.mockResolvedValue({
      id: testStudentId,
      name: 'Test Student',
      email: 'test@example.com',
      role: 'STUDENT' as const,
      quota: 0,
      cohort: DEFAULT_COHORT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createUseCase(): OrchestrateRecipeUseCase {
    return new OrchestrateRecipeUseCase(
      mockSessionRepo,
      mockInteractionRepo,
      mockRecipeRepo,
      mockAtomRepo,
      mockUserRepo,
      mockAiService,
      mockQuestionClassifier,
      mockRagService,
      mockComprehensionEvaluator,
      mockLessonEvaluator,
      undefined,
      undefined,
      mockFeatureFlagService,
    );
  }

  describe('Cohort-based engine routing', () => {
    beforeEach(() => {
      mockSessionRepo.findById.mockResolvedValueOnce(baseSession);
      mockRecipeRepo.findById.mockResolvedValueOnce(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValueOnce([testStep]);
      mockAtomRepo.findById.mockResolvedValueOnce(testAtom);
      mockInteractionRepo.findBySessionOrdered.mockResolvedValueOnce([]);
      mockAiService.generateResponse.mockResolvedValueOnce({
        explanation: 'Hello!',
        supportQuotes: [],
        pedagogicalState: 'ACTIVITY_WAIT' as const,
      });
    });

    it('should use new engine when FeatureFlagService.shouldUseNewEngine returns true for cohort', async () => {
      mockUserRepo.findById.mockResolvedValueOnce({
        id: testStudentId,
        name: 'Test Student',
        email: 'test@example.com',
        role: 'STUDENT' as const,
        quota: 0,
        cohort: 'beta-users',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFeatureFlagService.shouldUseNewEngine.mockReturnValue(true);
      mockLessonEvaluator.evaluate.mockResolvedValueOnce({
        outcome: 'correct',
        confidence: 0.9,
        improvementSuggestion: 'Great job!',
      });

      const useCase = createUseCase();
      const result = await useCase.interact(sessionId, '4', testStudentId);

      expect(mockFeatureFlagService.shouldUseNewEngine).toHaveBeenCalledWith('beta-users');
      expect(mockLessonEvaluator.evaluate).toHaveBeenCalled();
      expect(mockComprehensionEvaluator.evaluate).not.toHaveBeenCalled();
      expect(result.pedagogicalState).toBe('EVALUATION');
    });

    it('should use legacy engine when FeatureFlagService.shouldUseNewEngine returns false for cohort', async () => {
      mockUserRepo.findById.mockResolvedValueOnce({
        id: testStudentId,
        name: 'Test Student',
        email: 'test@example.com',
        role: 'STUDENT' as const,
        quota: 0,
        cohort: 'control-group',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFeatureFlagService.shouldUseNewEngine.mockReturnValue(false);
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'correct',
        confidence: 0.9,
      });

      const useCase = createUseCase();
      const result = await useCase.interact(sessionId, '4', testStudentId);

      expect(mockFeatureFlagService.shouldUseNewEngine).toHaveBeenCalledWith('control-group');
      expect(mockComprehensionEvaluator.evaluate).toHaveBeenCalled();
      expect(mockLessonEvaluator.evaluate).not.toHaveBeenCalled();
      expect(result.pedagogicalState).toBe('EVALUATION');
    });

    it('should default to legacy engine when FeatureFlagService is not provided', async () => {
      // Create use case without FeatureFlagService
      const useCaseWithoutFlagService = new OrchestrateRecipeUseCase(
        mockSessionRepo,
        mockInteractionRepo,
        mockRecipeRepo,
        mockAtomRepo,
        mockUserRepo,
        mockAiService,
        mockQuestionClassifier,
        mockRagService,
        mockComprehensionEvaluator,
        mockLessonEvaluator,
        undefined,
        undefined,
        undefined, // No FeatureFlagService
      );

      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'correct',
        confidence: 0.9,
      });

      const result = await useCaseWithoutFlagService.interact(sessionId, '4', testStudentId);

      expect(mockComprehensionEvaluator.evaluate).toHaveBeenCalled();
      expect(mockLessonEvaluator.evaluate).not.toHaveBeenCalled();
      expect(result.pedagogicalState).toBe('EVALUATION');
    });

    it('should default to legacy engine when FeatureFlagService throws error', async () => {
      mockFeatureFlagService.shouldUseNewEngine.mockImplementation(() => {
        throw new Error('Feature flag service error');
      });

      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'correct',
        confidence: 0.9,
      });

      const useCase = createUseCase();
      const result = await useCase.interact(sessionId, '4', testStudentId);

      expect(mockComprehensionEvaluator.evaluate).toHaveBeenCalled();
      expect(mockLessonEvaluator.evaluate).not.toHaveBeenCalled();
      expect(result.pedagogicalState).toBe('EVALUATION');
    });

    it('should use default cohort when student is not found', async () => {
      mockUserRepo.findById.mockResolvedValueOnce(null);
      mockFeatureFlagService.shouldUseNewEngine.mockReturnValue(false);

      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'correct',
        confidence: 0.9,
      });

      const useCase = createUseCase();
      await useCase.interact(sessionId, '4', testStudentId);

      expect(mockFeatureFlagService.shouldUseNewEngine).toHaveBeenCalledWith(DEFAULT_COHORT);
    });

    it('should use default cohort when student has no cohort defined', async () => {
      mockUserRepo.findById.mockResolvedValueOnce({
        id: testStudentId,
        name: 'Test Student',
        email: 'test@example.com',
        role: 'STUDENT' as const,
        quota: 0,
        cohort: '', // Empty cohort
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFeatureFlagService.shouldUseNewEngine.mockReturnValue(false);

      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'correct',
        confidence: 0.9,
      });

      const useCase = createUseCase();
      await useCase.interact(sessionId, '4', testStudentId);

      expect(mockFeatureFlagService.shouldUseNewEngine).toHaveBeenCalledWith(DEFAULT_COHORT);
    });

    it('should log which engine was used', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockFeatureFlagService.shouldUseNewEngine.mockReturnValue(true);
      mockLessonEvaluator.evaluate.mockResolvedValueOnce({
        outcome: 'correct',
        confidence: 0.9,
        improvementSuggestion: 'Great job!',
      });

      const useCase = createUseCase();
      await useCase.interact(sessionId, '4', testStudentId);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EVAL ENGINE: new]'),
        expect.stringContaining('cohort=beta-users'),
      );

      consoleSpy.mockRestore();
    });

    it('should pass correct evaluation request to new engine', async () => {
      mockFeatureFlagService.shouldUseNewEngine.mockReturnValue(true);
      mockLessonEvaluator.evaluate.mockResolvedValueOnce({
        outcome: 'correct',
        confidence: 0.95,
        improvementSuggestion: 'Excellent!',
      });

      const useCase = createUseCase();
      await useCase.interact(sessionId, '4', testStudentId);

      expect(mockLessonEvaluator.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          studentAnswer: '4',
          questionText: 'What is 2 + 2?',
          teacherConfig: expect.objectContaining({
            centralTruth: '4',
          }),
          lessonContext: expect.objectContaining({
            topic: 'Test Recipe',
          }),
        }),
      );
    });

    it('should pass correct params to legacy engine', async () => {
      mockFeatureFlagService.shouldUseNewEngine.mockReturnValue(false);
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'correct',
        confidence: 0.9,
      });

      const useCase = createUseCase();
      await useCase.interact(sessionId, '4', testStudentId);

      expect(mockComprehensionEvaluator.evaluate).toHaveBeenCalledWith({
        microQuestion: 'What is 2 + 2?',
        expectedAnswer: '4',
        studentAnswer: '4',
        attemptNumber: 1,
      });
    });
  });

  describe('Feature flag service error handling', () => {
    it('should handle shouldUseNewEngine returning error gracefully', async () => {
      mockSessionRepo.findById.mockResolvedValueOnce(baseSession);
      mockRecipeRepo.findById.mockResolvedValueOnce(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValueOnce([testStep]);
      mockAtomRepo.findById.mockResolvedValueOnce(testAtom);
      mockInteractionRepo.findBySessionOrdered.mockResolvedValueOnce([]);
      mockAiService.generateResponse.mockResolvedValueOnce({
        explanation: 'Hello!',
        supportQuotes: [],
        pedagogicalState: 'ACTIVITY_WAIT' as const,
      });

      // Simulate error during shouldUseNewEngine
      mockFeatureFlagService.shouldUseNewEngine.mockImplementation(() => {
        throw new Error('Database connection error');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'incorrect',
        confidence: 0.3,
      });

      const useCase = createUseCase();
      await useCase.interact(sessionId, 'wrong', testStudentId);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('FeatureFlagService error'),
        expect.any(Error),
      );
      expect(mockComprehensionEvaluator.evaluate).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
