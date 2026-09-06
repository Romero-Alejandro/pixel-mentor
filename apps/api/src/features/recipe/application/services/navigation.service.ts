/**
 * Navigation Service
 *
 * Encapsulates the navigation fast path logic: detecting simple navigation
 * inputs (continuar, siguiente, __auto__, etc.) and determining the next
 * step transition without requiring LLM calls.
 *
 * Extracted from OrchestrateRecipeUseCase to reduce the 800-line interactStream
 * monolith and make navigation logic independently testable.
 */

import type { RecipeStep } from '@/features/recipe/domain/entities/recipe.entity.js';

// ---- Constants ----

/**
 * Words that trigger navigation (auto-advance to next step).
 * These skip LLM calls entirely.
 */
const NAVIGATION_WORDS = [
  '__auto__', // Auto-advance trigger from frontend
  'continuar',
  'siguiente',
  'next',
  'ok',
  'dale',
  'vamos',
  'adelante',
  'seguir',
  'avanzar',
  'proseguir',
  'forward',
];

/**
 * Pedagogical states where navigation input should NOT trigger auto-advance.
 * In these states, the student must provide a meaningful answer, not just "continuar".
 */
const NAVIGATION_BLOCKED_STATES = ['ACTIVITY_WAIT', 'RESOLVING_DOUBT', 'CLARIFYING'];

// ---- Types ----

export type StepType = 'content' | 'activity' | 'question' | 'intro' | 'closure' | 'exam';

export interface NavigationInputResult {
  /** Whether the input is a navigation trigger */
  isNavigation: boolean;
  /** The normalized lowercase input for downstream processing */
  normalizedInput: string;
}

export interface NextStepResult {
  /** The index of the next step, or null if at the end */
  nextStepIndex: number | null;
  /** The next step object (if available) */
  nextStep: RecipeStep | undefined;
  /** Whether this navigation completes the lesson */
  willComplete: boolean;
}

export interface StepTransition {
  /** The pedagogical state to transition to */
  targetState: string;
  /** Whether the next step requires student input */
  requiresInput: boolean;
  /** Whether auto-advance should happen after this step */
  autoAdvance: boolean;
}

// ---- Input Detection ----

/**
 * Determines if a student input is a navigation trigger.
 *
 * @param studentInput - The raw student input text
 * @param currentState - The current pedagogical state
 * @returns NavigationInputResult with isNavigation flag and normalized input
 */
export function detectNavigationInput(
  studentInput: string,
  currentState: string,
): NavigationInputResult {
  const normalizedInput = studentInput.toLowerCase().trim();

  // Navigation is blocked in states that require meaningful answers
  if (NAVIGATION_BLOCKED_STATES.includes(currentState)) {
    return { isNavigation: false, normalizedInput };
  }

  const isNavigation = NAVIGATION_WORDS.some(
    (w) => normalizedInput === w || normalizedInput.includes(w),
  );

  return { isNavigation, normalizedInput };
}

// ---- Step Advancement ----

/**
 * Calculates the next step index based on the current position.
 *
 * @param steps - The recipe steps array
 * @param currentIndex - The current step index
 * @returns NextStepResult with next index, step, and completion flag
 */
export function calculateNextStep(
  steps: readonly RecipeStep[],
  currentIndex: number,
): NextStepResult {
  const nextIndex = currentIndex + 1;
  const willComplete = nextIndex >= steps.length;

  return {
    nextStepIndex: willComplete ? null : nextIndex,
    nextStep: willComplete ? undefined : steps[nextIndex],
    willComplete,
  };
}

// ---- Transition Logic ----

/**
 * Determines the target state for a step, considering the step type.
 *
 * @param step - The recipe step to transition to
 * @returns StepTransition with target state and flags
 */
export function determineStepTransition(step: RecipeStep): StepTransition {
  const stepType = (step.stepType ?? 'content') as StepType;
  const upperType = stepType.toUpperCase();

  // Activity/exam steps wait for student input
  if (upperType === 'ACTIVITY' || upperType === 'EXAM') {
    return {
      targetState: 'ACTIVITY_WAIT',
      requiresInput: true,
      autoAdvance: false,
    };
  }

  // Question steps also wait for student input
  if (upperType === 'QUESTION') {
    return {
      targetState: 'ACTIVITY_WAIT',
      requiresInput: true,
      autoAdvance: false,
    };
  }

  // Content/intro/closure steps can auto-advance
  return {
    targetState: 'EXPLANATION',
    requiresInput: false,
    autoAdvance: true,
  };
}
