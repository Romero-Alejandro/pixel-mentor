import { createLogger } from '@/shared/logger/logger.js';
import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type {
  ComprehensionEvaluator,
  ComprehensionEvaluation,
} from '@/features/recipe/domain/ports/question-classifier.port.js';
import type { LessonEvaluatorUseCase } from '@/features/evaluation/application/services/lesson.evaluator.js';
import type {
  EvaluationRequest,
  EvaluationResult,
  EvaluationOutcome as PedagogicalOutcome,
} from '@/features/evaluation/domain/entities/evaluation-types.js';
import type { FeatureFlagService } from '@/shared/config/evaluation-flags.js';
import {
  EvaluationMetricsCollector,
  EvaluationTimer,
  type EngineType,
  type EvaluationOutcome,
  type EvaluationErrorType,
} from '@/shared/monitoring/eval-metrics.js';
import { DEFAULT_COHORT as USER_DEFAULT_COHORT } from '@/features/auth/domain/entities/user.entity.js';
import type { QuestionScript } from '@/features/recipe/application/services/step-script.mapper.js';

const logger = createLogger(undefined, { name: 'answer-evaluation', level: 'info' });

export interface EvaluateAnswerParams {
  script: QuestionScript;
  studentInput: string;
  attemptNumber: number;
  recipeTitle: string;
  stepIndex: number;
  studentId?: string;
}

/**
 * Unified answer-evaluation engine.
 *
 * Routes each student answer to the appropriate evaluator (new LessonEvaluator
 * LLM engine or legacy ComprehensionEvaluator) based on the student's cohort
 * feature flag, and records evaluation metrics for observability.
 *
 * Extracted from OrchestrateRecipeUseCase (Phase 4 refactor) — pure evaluation
 * logic, no session/state-machine concerns.
 */
export class AnswerEvaluationService {
  constructor(
    private userRepo: IUserRepository,
    private comprehensionEvaluator: ComprehensionEvaluator,
    private lessonEvaluator: LessonEvaluatorUseCase,
    private featureFlagService?: FeatureFlagService,
  ) {}

  /**
   * Unified evaluation method that routes to the appropriate engine based on cohort feature flag.
   */
  async evaluateAnswer(params: EvaluateAnswerParams): Promise<ComprehensionEvaluation> {
    // Fetch student cohort for feature flag evaluation
    const cohort = await this.getStudentCohort(params.studentId);
    const useNewEngine = this.shouldUseNewEngine(cohort);
    const engineType: EngineType = useNewEngine ? 'new' : 'old';

    // Create metrics collector for this evaluation
    const metrics = new EvaluationMetricsCollector();
    const timer = new EvaluationTimer();
    const completeTracking = metrics.startEvaluation(engineType, cohort);

    // Log which engine is being used for observability
    logger.info(
      `[EVAL ENGINE: ${engineType}] cohort=${cohort} requestId=${metrics.getRequestId()}`,
    );

    try {
      let result: ComprehensionEvaluation;

      if (useNewEngine) {
        result = await this.evaluateWithLessonEngine(params);
      } else {
        result = await this.evaluateWithLegacyEngine(params);
      }

      // Record completion metrics
      const latencyMs = timer.getElapsed();
      const outcome = result.result as EvaluationOutcome;
      metrics.recordCompletion(engineType, outcome, latencyMs, cohort);

      logger.info(
        `[EVAL COMPLETE] engine=${engineType} outcome=${outcome} latency=${latencyMs}ms cohort=${cohort} requestId=${metrics.getRequestId()}`,
      );

      // Call the tracking completion function
      completeTracking(outcome);

      return result;
    } catch (error) {
      // Record error metrics
      const latencyMs = timer.getElapsed();
      const errorType = this.categorizeError(error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metrics.recordError(errorType, errorMessage);

      logger.error(
        {
          err: error,
          engine: engineType,
          errorType,
          latencyMs,
          cohort,
          requestId: metrics.getRequestId(),
        },
        `[EVAL ERROR] engine=${engineType} error=${errorType} latency=${latencyMs}ms cohort=${cohort} requestId=${metrics.getRequestId()}`,
      );

      // Call the tracking completion function with error
      completeTracking(undefined, errorType, errorMessage);

      // Return graceful fallback
      return {
        result: 'incorrect',
        confidence: 0,
        hint: params.script.hint,
        shouldEscalate: false,
      };
    }
  }

  // ─── evaluateWithLessonEngine ───────────────────────────────────────────
  /**
   * Evaluates a student's answer using the new LessonEvaluatorUseCase engine.
   *
   * Maps the existing script data to the new EvaluationRequest DTO:
   * - TeacherConfig: centralTruth from expectedAnswer, empty keywords (future extraction possible)
   * - LessonContext: built from recipe metadata
   * - EvaluationRequest: studentAnswer = studentInput
   */
  private async evaluateWithLessonEngine(
    params: EvaluateAnswerParams,
  ): Promise<ComprehensionEvaluation> {
    // attemptNumber reserved for future use (adaptive hints based on attempts)
    void params.attemptNumber;
    const { script, studentInput, recipeTitle } = params;

    // Build TeacherConfig from script
    const teacherConfig = {
      centralTruth: script.expectedAnswer ?? '',
      requiredKeywords: [] as string[], // Could extract from expectedAnswer in future
      maxScore: 10,
    };

    // Build LessonContext from recipe metadata
    // Note: For more accurate context, we could extract subject/gradeLevel from recipe.meta
    const lessonContext = {
      subject: 'Educación General', // Could be extracted from recipe metadata
      gradeLevel: 'Nivel General', // Could be extracted from recipe metadata
      topic: recipeTitle,
    };

    // Build EvaluationRequest
    const request: EvaluationRequest = {
      studentAnswer: studentInput,
      questionText: script.question,
      teacherConfig,
      lessonContext,
    };

    logger.debug(
      {
        studentAnswer: studentInput,
        questionText: script.question,
        expectedAnswer: script.expectedAnswer,
      },
      '[DEBUG] evaluateWithLessonEngine - calling LLM',
    );

    try {
      const result: EvaluationResult = await this.lessonEvaluator.evaluate(request);

      logger.debug(
        {
          outcome: result.outcome,
          score: result.score,
          feedback: result.feedback,
          confidence: result.confidence,
        },
        '[DEBUG] evaluateWithLessonEngine - LLM result',
      );

      // Map 6-category EvaluationOutcome to 3-category ComprehensionEvaluation
      // This mapping ensures backward compatibility with the frontend
      const pedagogicalOutcome = result.outcome as PedagogicalOutcome;
      const mappedResult = this.mapPedagogicalOutcomeToComprehension(pedagogicalOutcome);

      // Map confidence (normalize if needed)
      const mappedConfidence = this.normalizePedagogicalConfidence(
        result.confidence,
        pedagogicalOutcome,
      );

      return {
        result: mappedResult,
        confidence: mappedConfidence,
        hint: result.improvementSuggestion,
        shouldEscalate: this.shouldEscalateBasedOnPedagogicalOutcome(pedagogicalOutcome),
      };
    } catch (error) {
      // Graceful fallback to incorrect on error
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ err: errorMessage }, '[AnswerEvaluation] LessonEvaluator error');
      return {
        result: 'incorrect',
        confidence: 0,
        hint: script.hint,
        shouldEscalate: false,
      };
    }
  }

  /**
   * Maps the 6-category pedagogical outcome to the 3-category legacy outcome.
   * This ensures backward compatibility with the frontend while using the new evaluator.
   */
  private mapPedagogicalOutcomeToComprehension(
    outcome: PedagogicalOutcome,
  ): 'correct' | 'partial' | 'incorrect' {
    switch (outcome) {
      case 'conceptually_correct':
      case 'intuitive_correct':
        return 'correct';
      case 'partially_correct':
      case 'relevant_but_incomplete':
        return 'partial';
      case 'conceptual_error':
      case 'no_response':
        return 'incorrect';
      default:
        // Fallback for any unknown outcome
        return 'incorrect';
    }
  }

  /**
   * Normalizes confidence based on the pedagogical evaluation outcome.
   * Higher confidence for correct answers, lower for partial.
   */
  private normalizePedagogicalConfidence(confidence: number, outcome: PedagogicalOutcome): number {
    // Ensure confidence is between 0 and 1
    const normalized = Math.max(0, Math.min(1, confidence));

    // Boost confidence for conceptually correct answers
    if (outcome === 'conceptually_correct' && normalized < 0.8) {
      return 0.9;
    }

    // Keep higher confidence for intuitive correct (shows understanding)
    if (outcome === 'intuitive_correct' && normalized < 0.7) {
      return 0.8;
    }

    return normalized;
  }

  /**
   * Determines if the evaluation should escalate based on the pedagogical outcome.
   * Used to trigger additional help for struggling students.
   */
  private shouldEscalateBasedOnPedagogicalOutcome(outcome: PedagogicalOutcome): boolean {
    // Escalate on conceptual errors or no response to provide extra support
    return outcome === 'conceptual_error' || outcome === 'no_response';
  }

  // ─── evaluateWithLegacyEngine ───────────────────────────────────────────
  /**
   * Evaluates using the legacy ComprehensionEvaluator adapter.
   * Maintains backward compatibility with existing implementations.
   */
  private async evaluateWithLegacyEngine(
    params: EvaluateAnswerParams,
  ): Promise<ComprehensionEvaluation> {
    const { script, studentInput, attemptNumber } = params;

    return this.comprehensionEvaluator.evaluate({
      microQuestion: script.question,
      expectedAnswer: script.expectedAnswer ?? '',
      studentAnswer: studentInput,
      attemptNumber,
    });
  }

  /**
   * Categorize an error into a specific error type for metrics
   */
  private categorizeError(error: unknown): EvaluationErrorType {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('timeout')) {
        return 'timeout_error';
      }
      if (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('connection')
      ) {
        return 'network_error';
      }
      if (
        message.includes('validation') ||
        message.includes('schema') ||
        message.includes('parse')
      ) {
        return 'validation_error';
      }
      if (
        message.includes('llm') ||
        message.includes('openai') ||
        message.includes('gemini') ||
        message.includes('anthropic')
      ) {
        return 'llm_error';
      }
    }
    return 'unknown_error';
  }

  /**
   * Retrieves the student's cohort from their user profile.
   * Defaults to 'default' cohort if student not found or cohort not set.
   */
  private async getStudentCohort(studentId?: string): Promise<string> {
    if (!studentId) {
      return USER_DEFAULT_COHORT;
    }

    try {
      const student = await this.userRepo.findById(studentId);
      return student?.cohort ?? USER_DEFAULT_COHORT;
    } catch {
      logger.warn(
        { studentId },
        '[AnswerEvaluation] Failed to fetch student cohort, using default',
      );
      return USER_DEFAULT_COHORT;
    }
  }

  /**
   * Determines if the new evaluation engine should be used based on cohort configuration.
   * Returns false (legacy engine) if FeatureFlagService is not available (backward compatibility).
   */
  private shouldUseNewEngine(cohort: string): boolean {
    if (!this.featureFlagService) {
      // FeatureFlagService not available - default to legacy engine for backward compatibility
      return false;
    }

    try {
      return this.featureFlagService.shouldUseNewEngine(cohort);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { err: errorMessage, cohort },
        `[AnswerEvaluation] FeatureFlagService error for cohort ${cohort}`,
      );
      // Default to legacy engine on error to maintain backward compatibility
      return false;
    }
  }
}
