/**
 * Lesson Evaluator Module
 *
 * Exports the LessonEvaluatorUseCase and all related types for pedagogical
 * student answer evaluation using the 3-step flow.
 */

export { LessonEvaluatorUseCase, createLessonEvaluator } from './lesson.evaluator';

// Re-export from types
export { EVALUATION_OUTCOME } from './types';
export type {
  EvaluationOutcome,
  ExtractedConcepts,
  LessonContext,
  StudentProfile,
  TeacherConfig,
  EvaluationRequest,
  EvaluationResult,
} from './types';

// Re-export from schemas
export {
  ExtractConceptsResponseSchema,
  ClassificationResponseSchema,
  FeedbackResponseSchema,
  EvaluationResponseSchema,
} from './schemas';
export type {
  ExtractConceptsResponse,
  ClassificationResponse,
  FeedbackResponse,
  EvaluationResponse,
} from './schemas';
