/**
 * Lesson Evaluator Module
 *
 * Exports the LessonEvaluatorUseCase and all related types for rubric-based
 * student answer evaluation.
 */

export {
  LessonEvaluatorUseCase,
  EvaluationResponseSchema,
  createLessonEvaluator,
} from './lesson.evaluator';

export type {
  EvaluationRequest,
  EvaluationResult,
  EvaluationOutcome,
  TeacherConfig,
  LessonContext,
  StudentProfile,
  RubricCriterion,
  EvaluationResponse,
} from './lesson.evaluator';
