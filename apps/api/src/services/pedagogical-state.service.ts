/**
 * Pedagogical State Service
 *
 * Centralized service that manages all pedagogical state transitions.
 * Wraps PedagogicalStateMachine and provides:
 * - Event-driven state transitions
 * - Timeout handling
 * - Structured logging
 * - Step index management
 */

import { EventEmitter } from 'node:events';

import {
  type PedagogicalState,
  type StateEventType,
  type StateEvent,
  isTransitionAllowed,
  getAllowedTransitions,
  getNextState,
} from '../features/evaluation/domain/entities/pedagogical-state-machine.js';
import { type RecipeConfig } from '../features/recipe/domain/entities/recipe-config.entity.js';
import { createLogger } from '../shared/logger/logger.js';

const logger = createLogger(undefined, { name: 'pedagogical-state-service' });

/**
 * Extended state context that includes step management
 */
export interface StateContext {
  currentState: PedagogicalState;
  currentStepIndex: number;
  totalSteps: number;
  savedStepIndex?: number;
  failedAttempts: number;
  lastActivityTime: number;
  skippedActivities: string[];
}

/**
 * Result of a state transition
 */
export interface TransitionResult {
  success: boolean;
  previousState: PedagogicalState;
  nextState: PedagogicalState;
  previousStepIndex: number;
  nextStepIndex: number;
  event: StateEventType;
  error?: string;
}

/**
 * Event emitted when state changes
 */
export interface StateChangeEvent {
  previousState: PedagogicalState;
  nextState: PedagogicalState;
  event: StateEventType;
  context: StateContext;
}

/**
 * Service for managing pedagogical state transitions
 */
export class PedagogicalStateService extends EventEmitter {
  private context: StateContext;
  private config: RecipeConfig;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private inactivityHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(initialContext: StateContext, config: RecipeConfig) {
    super();
    this.context = initialContext;
    this.config = config;
    this.startTimeoutTimer();
  }

  /**
   * Get current state context
   */
  getContext(): Readonly<StateContext> {
    return { ...this.context };
  }

  /**
   * Get current pedagogical state
   */
  getCurrentState(): PedagogicalState {
    return this.context.currentState;
  }

  /**
   * Process an event and transition to a new state
   * This is the MAIN entry point for all state transitions
   */
  processEvent(eventType: StateEventType, _metadata?: Partial<StateEvent>): TransitionResult {
    const previousState = this.context.currentState;
    const previousStepIndex = this.context.currentStepIndex;

    // Validate transition
    if (!isTransitionAllowed(previousState, eventType)) {
      const allowed = getAllowedTransitions(previousState);
      logger.warn(
        {
          currentState: previousState,
          eventType,
          allowedEvents: allowed,
        },
        '[PedagogicalStateService] Invalid transition attempt',
      );

      return {
        success: false,
        previousState,
        nextState: previousState,
        previousStepIndex,
        nextStepIndex: previousStepIndex,
        event: eventType,
        error: `Event ${eventType} not allowed in state ${previousState}. Allowed: ${allowed.join(', ')}`,
      };
    }

    // Calculate next state using the state machine
    const nextState = getNextState(previousState, { type: eventType });

    // Calculate step changes based on event
    const stepChange = this.calculateStepChange(eventType);
    const nextStepIndex = this.calculateNextStepIndex(stepChange, previousStepIndex);

    // Update context
    this.context = {
      ...this.context,
      currentState: nextState,
      currentStepIndex: nextStepIndex,
      lastActivityTime: Date.now(),
    };

    // Reset timers for new state
    this.resetTimers();

    // Log transition
    logger.info(
      {
        previousState,
        nextState,
        eventType,
        previousStepIndex,
        nextStepIndex,
      },
      '[PedagogicalStateService] State transition',
    );

    // Emit state change event
    this.emit('stateChange', {
      previousState,
      nextState,
      event: eventType,
      context: { ...this.context },
    } as StateChangeEvent);

    return {
      success: true,
      previousState,
      nextState,
      previousStepIndex,
      nextStepIndex,
      event: eventType,
    };
  }

  /**
   * Calculate step index changes based on event type
   */
  private calculateStepChange(eventType: StateEventType): 'advance' | 'repeat' | 'stay' {
    switch (eventType) {
      case 'ADVANCE':
      case 'SKIP_ACTIVITY':
      case 'CONTINUE':
        return 'advance';

      case 'REPEAT_CONCEPT':
        return 'repeat';

      case 'START_CLASS':
      case 'RESUME_CLASS':
      case 'ANSWER':
      case 'EVALUATE_CORRECT':
      case 'EVALUATE_INCORRECT':
      case 'EVALUATE_PARTIAL':
      case 'OFFER_SKIP':
      case 'ACTIVITY_TIMEOUT':
      case 'SHOW_ENCOURAGEMENT':
        return 'stay';

      default:
        return 'stay';
    }
  }

  /**
   * Calculate next step index based on step change type
   */
  private calculateNextStepIndex(
    stepChange: 'advance' | 'repeat' | 'stay',
    currentIndex: number,
  ): number {
    const totalSteps = this.context.totalSteps;

    switch (stepChange) {
      case 'advance':
        // Advance to next step, but don't exceed total
        return Math.min(currentIndex + 1, totalSteps - 1);

      case 'repeat':
        // Go back to previous content step
        return Math.max(0, currentIndex - 1);

      case 'stay':
      default:
        return currentIndex;
    }
  }

  /**
   * Start timeout timer based on current state
   */
  private startTimeoutTimer(): void {
    this.clearTimers();

    const timeoutMs = this.getTimeoutForState(this.context.currentState);
    if (timeoutMs > 0) {
      this.timeoutHandle = setTimeout(() => {
        this.handleTimeout();
      }, timeoutMs);
    }
  }

  /**
   * Get timeout duration for a given state
   */
  private getTimeoutForState(state: PedagogicalState): number {
    switch (state) {
      case 'ACTIVITY_WAIT':
        return this.config.activityTimeoutSeconds * 1000;

      case 'ACTIVITY_INACTIVITY_WARNING':
        return (
          (this.config.skipAfterInactivitySeconds -
            this.config.encouragementAfterInactivitySeconds) *
          1000
        );

      default:
        return 0;
    }
  }

  /**
   * Handle timeout event
   */
  private handleTimeout(): void {
    const state = this.context.currentState;

    let eventType: StateEventType;

    if (state === 'ACTIVITY_WAIT') {
      // First timeout - show encouragement
      if (this.context.failedAttempts < this.config.skipAfterFailedAttempts) {
        eventType = 'SHOW_ENCOURAGEMENT';
      } else {
        eventType = 'ACTIVITY_TIMEOUT';
      }
    } else if (state === 'ACTIVITY_INACTIVITY_WARNING') {
      // Second timeout - offer skip
      eventType = 'ACTIVITY_TIMEOUT';
    } else {
      return;
    }

    logger.info(
      {
        state,
        eventType,
        failedAttempts: this.context.failedAttempts,
      },
      '[PedagogicalStateService] Timeout triggered',
    );

    this.processEvent(eventType);
  }

  /**
   * Reset timers when state changes
   */
  private resetTimers(): void {
    this.clearTimers();
    this.startTimeoutTimer();
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    if (this.inactivityHandle) {
      clearTimeout(this.inactivityHandle);
      this.inactivityHandle = null;
    }
  }

  /**
   * Update config (can be called when recipe config changes)
   */
  updateConfig(config: RecipeConfig): void {
    this.config = config;
    this.resetTimers();
  }

  /**
   * Update step index directly (for resuming sessions)
   */
  setStepIndex(index: number): void {
    this.context.currentStepIndex = Math.max(0, Math.min(index, this.context.totalSteps - 1));
  }

  /**
   * Update total steps
   */
  setTotalSteps(total: number): void {
    this.context.totalSteps = total;
  }

  /**
   * Increment failed attempts counter
   */
  incrementFailedAttempts(): void {
    this.context.failedAttempts++;
  }

  /**
   * Reset failed attempts counter
   */
  resetFailedAttempts(): void {
    this.context.failedAttempts = 0;
  }

  /**
   * Add skipped activity
   */
  addSkippedActivity(atomId: string): void {
    this.context.skippedActivities.push(atomId);
  }

  /**
   * Check if event is allowed in current state
   */
  canProcessEvent(eventType: StateEventType): boolean {
    return isTransitionAllowed(this.context.currentState, eventType);
  }

  /**
   * Get allowed events for current state
   */
  getAllowedEvents(): StateEventType[] {
    return getAllowedTransitions(this.context.currentState);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearTimers();
    this.removeAllListeners();
  }
}

/**
 * Create initial state context
 */
export function createInitialContext(
  initial: PedagogicalState,
  totalSteps: number,
  stepIndex: number = 0,
): StateContext {
  return {
    currentState: initial,
    currentStepIndex: stepIndex,
    totalSteps,
    failedAttempts: 0,
    lastActivityTime: Date.now(),
    skippedActivities: [],
  };
}
