/**
 * Evaluator Schemas Module
 *
 * Zod schemas for validating LLM responses in the 3-step pedagogical evaluation flow.
 * Each step has its own schema to ensure type safety and response format consistency.
 */

import { z } from 'zod';

// ============================================================
// Step 1: Extract Concepts Response
// ============================================================

/**
 * Schema for the concept extraction step (Step 1).
 * The LLM extracts key ideas from the student's answer.
 */
export const ExtractConceptsResponseSchema = z.object({
  /** Key ideas expressed by the student */
  ideas: z.array(z.string()).min(1),

  /** Complexity level of the student's language */
  languageComplexity: z.enum(['simple', 'moderate', 'advanced']),

  /** Whether the student used analogies or metaphors */
  hasAnalogies: z.boolean(),

  /** Brief explanation of the extraction logic */
  reasoning: z.string().optional(),
});

export type ExtractConceptsResponse = z.infer<typeof ExtractConceptsResponseSchema>;

// ============================================================
// Step 2: Classification Response
// ============================================================

/**
 * Schema for the classification step (Step 2).
 * Uses the 6-category pedagogical classification system.
 */
export const ClassificationResponseSchema = z.object({
  /** The classification outcome */
  outcome: z.enum([
    'conceptually_correct',
    'intuitive_correct',
    'partially_correct',
    'relevant_but_incomplete',
    'conceptual_error',
    'no_response',
  ]),

  /** Numeric score from 0 to maxScore (default 10) */
  score: z.number().min(0).max(10),

  /** Brief justification for the classification */
  justification: z.string(),

  /** Confidence level (0-1) */
  confidence: z.number().min(0).max(1).optional(),

  /** Optional improvement suggestion */
  improvementSuggestion: z.string().optional(),
});

export type ClassificationResponse = z.infer<typeof ClassificationResponseSchema>;

// ============================================================
// Step 3: Feedback Response
// ============================================================

/**
 * Schema for the feedback generation step (Step 3).
 * Ensures feedback is always positive, pedagogical, and child-friendly.
 */
export const FeedbackResponseSchema = z.object({
  /** The feedback message for the student */
  feedback: z.string().min(1),

  /** Whether this includes an encouragement */
  hasEncouragement: z.boolean().optional(),
});

export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;

// ============================================================
// Combined Response (for backwards compatibility)
// ============================================================

/**
 * Combined evaluation response for use when not using the 3-step flow.
 * Maintains backwards compatibility with existing code.
 */
export const EvaluationResponseSchema = z.object({
  outcome: z.enum([
    'conceptually_correct',
    'intuitive_correct',
    'partially_correct',
    'relevant_but_incomplete',
    'conceptual_error',
    'no_response',
  ]),
  score: z.number().min(0).max(10),
  feedback: z.string(),
  improvementSuggestion: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type EvaluationResponse = z.infer<typeof EvaluationResponseSchema>;
