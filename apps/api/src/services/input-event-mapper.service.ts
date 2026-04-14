/**
 * Input Event Mapper Service
 *
 * Maps user input and classification results to pedagogical events.
 * This is the ONLY place where input -> event mapping happens.
 */

import type {
  PedagogicalState,
  StateEventType,
} from '../features/evaluation/domain/entities/pedagogical-state-machine.js';

export interface ClassificationResult {
  intent: 'question' | 'statement' | 'navigation' | 'clarification';
  confidence: number;
  type?: 'accept' | 'reject' | 'clarify';
}

/**
 * Maps user input to pedagogical events
 */
export class InputEventMapperService {
  // Navigation keywords that trigger navigation
  private readonly NAV_KEYWORDS = [
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

  // Ready confirmation keywords
  private readonly READY_KEYWORDS = [
    'sí',
    'si',
    'comenzar',
    'start',
    'listo',
    'ready',
    'ok',
    'dale',
    'continuar',
  ];

  // Retry keywords
  private readonly RETRY_KEYWORDS = ['repetir', 'otra vez', 'again', 'retry'];

  // Skip keywords
  private readonly SKIP_KEYWORDS = ['saltar', 'skip', 'pasar', 'siguiente'];

  /**
   * Map user input to a pedagogical event
   */
  mapInputToEvent(
    input: string,
    currentState: PedagogicalState,
    classification: ClassificationResult,
    canAskQuestion: boolean = true,
    canRetry: boolean = true,
  ): { event: StateEventType; metadata?: Record<string, unknown> } | null {
    const normalizedInput = input.toLowerCase().trim();

    // Handle each state-specific mapping
    switch (currentState) {
      case 'AWAITING_START':
        return this.handleAwaitingStart(normalizedInput);

      case 'EXPLANATION':
      case 'ACTIVE_CLASS':
        return this.handleExplanationState(normalizedInput, classification, canAskQuestion);

      case 'ACTIVITY_WAIT':
      case 'ACTIVITY_INACTIVITY_WARNING':
        // In activity states, ANY input is treated as an answer attempt
        // The evaluation happens AFTER the transition, not before
        // Return null to signal that the use case should evaluate the answer first
        return null; // Caller should evaluate then call with EVALUATE_CORRECT/EVALUATE_INCORRECT

      case 'EVALUATION':
        return this.handleEvaluationState(normalizedInput, canRetry);

      case 'ACTIVITY_SKIP_OFFER':
        return this.handleSkipOfferState(normalizedInput);

      case 'RESOLVING_DOUBT':
      case 'CLARIFYING':
        return { event: 'RESUME_CLASS' };

      case 'QUESTION':
        // Same as ACTIVITY_WAIT - any input is an answer
        return null;

      case 'COMPLETED':
        return null;

      default:
        return null;
    }
  }

  /**
   * Handle AWAITING_START state
   */
  private handleAwaitingStart(input: string): { event: StateEventType } | null {
    const isReady = this.READY_KEYWORDS.some((keyword: string) => input.includes(keyword));

    if (isReady) {
      return { event: 'START_CLASS' };
    }

    // If not ready, stay in AWAITING_START (no event)
    return null;
  }

  /**
   * Handle EXPLANATION/ACTIVE_CLASS states
   */
  private handleExplanationState(
    input: string,
    classification: ClassificationResult,
    canAskQuestion: boolean,
  ): { event: StateEventType } | null {
    const isNavInput = this.NAV_KEYWORDS.some(
      (keyword) => input === keyword || input.includes(keyword),
    );

    // Navigation input - advance to next step
    if (isNavInput) {
      return { event: 'CONTINUE' };
    }

    // Question from student
    if (classification.intent === 'question' && classification.type === 'accept') {
      if (canAskQuestion) {
        return { event: 'RAISE_HAND' };
      } else {
        // Can't ask, stay in current state
        return null;
      }
    }

    // Clarification request
    if (classification.type === 'clarify') {
      return { event: 'CLARIFY' };
    }

    // Default: continue with current content
    return { event: 'CONTINUE' };
  }

  /**
   * Handle EVALUATION state
   */
  private handleEvaluationState(
    input: string,
    canRetry: boolean,
  ): { event: StateEventType } | null {
    const isNavInput = this.NAV_KEYWORDS.some(
      (keyword) => input === keyword || input.includes(keyword),
    );

    const isRetryInput = this.RETRY_KEYWORDS.some((keyword) => input.includes(keyword));

    // Navigation - advance to next step
    if (isNavInput) {
      return { event: 'ADVANCE' };
    }

    // Retry - repeat the current concept
    if (isRetryInput && canRetry) {
      return { event: 'REPEAT_CONCEPT' };
    }

    // If neither, could be re-evaluating - return null to let caller handle
    return null;
  }

  /**
   * Handle ACTIVITY_SKIP_OFFER state
   */
  private handleSkipOfferState(input: string): { event: StateEventType } | null {
    const isRetryInput = this.RETRY_KEYWORDS.some((keyword) => input.includes(keyword));
    const isSkipInput = this.SKIP_KEYWORDS.some((keyword) => input.includes(keyword));

    if (isRetryInput) {
      return { event: 'REPEAT_CONCEPT' };
    }

    if (isSkipInput) {
      return { event: 'SKIP_ACTIVITY' };
    }

    // Default to continue
    return { event: 'CONTINUE' };
  }

  /**
   * Check if input is a navigation command
   */
  isNavigationInput(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    return this.NAV_KEYWORDS.some(
      (keyword) => normalized === keyword || normalized.includes(keyword),
    );
  }

  /**
   * Check if input indicates readiness to start
   */
  isReadyInput(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    return this.READY_KEYWORDS.some((keyword: string) => normalized.includes(keyword));
  }
}

/**
 * Singleton instance
 */
export const inputEventMapper = new InputEventMapperService();
