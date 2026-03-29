/**
 * Integration Tests for Session Domain
 *
 * Tests cover:
 * - Session lifecycle (create → start → pause → resume → complete)
 * - State transition validation
 * - Error handling with AppError
 */

import {
  createSession,
  startSession,
  pauseForQuestion,
  awaitConfirmation,
  pauseIdle,
  resumeSession,
  completeSession,
  escalateSession,
  isTerminalStatus,
  type Session,
  type SessionCheckpoint,
} from '@/domain/entities/session.js';

import { validateSessionTransition, SESSION_TRANSITIONS } from '@/domain/validators/index.js';

import { AppError, ErrorCodes } from '@/domain/errors/index.js';

// ==================== Helpers ====================

const createTestSession = (overrides: Partial<Session> = {}): Session => {
  const base = createSession({
    id: 'test-session-1',
    studentId: 'student-1',
    recipeId: 'recipe-1',
  });
  return { ...base, ...overrides };
};

const createTestCheckpoint = (overrides: Partial<SessionCheckpoint> = {}): SessionCheckpoint => ({
  currentState: 'ACTIVE_CLASS',
  currentStepIndex: 0,
  questionCount: 0,
  lastQuestionTime: null,
  skippedActivities: [],
  failedAttempts: 0,
  totalWrongAnswers: 0,
  ...overrides,
});

// ==================== Test Suite ====================

describe('Session Domain Integration Tests', () => {
  // ==================== Session Creation ====================

  describe('Session Creation', () => {
    it('should create a session with IDLE status', () => {
      const session = createTestSession();

      expect(session.id).toBe('test-session-1');
      expect(session.studentId).toBe('student-1');
      expect(session.recipeId).toBe('recipe-1');
      expect(session.status).toBe('IDLE');
      expect(session.completedAt).toBeNull();
      expect(session.escalatedAt).toBeNull();
    });

    it('should initialize checkpoint with defaults', () => {
      const session = createTestSession();

      expect(session.stateCheckpoint.currentState).toBe('ACTIVE_CLASS');
      expect(session.stateCheckpoint.currentStepIndex).toBe(0);
    });
  });

  // ==================== Session Lifecycle ====================

  describe('Session Lifecycle', () => {
    it('should complete full lifecycle: IDLE → ACTIVE → COMPLETED', () => {
      const session = createTestSession();

      // Start session
      const activeSession = startSession(session);
      expect(activeSession.status).toBe('ACTIVE');

      // Complete session
      const completedSession = completeSession(activeSession);
      expect(completedSession.status).toBe('COMPLETED');
      expect(completedSession.completedAt).toBeInstanceOf(Date);
    });

    it('should complete lifecycle with question pause: IDLE → ACTIVE → PAUSED → ACTIVE → COMPLETED', () => {
      const session = createTestSession();
      const checkpoint = createTestCheckpoint();

      // Start
      const active = startSession(session);
      expect(active.status).toBe('ACTIVE');

      // Pause for question
      const paused = pauseForQuestion(active, checkpoint);
      expect(paused.status).toBe('PAUSED_FOR_QUESTION');

      // Resume
      const resumed = resumeSession(paused);
      expect(resumed.status).toBe('ACTIVE');

      // Complete
      const completed = completeSession(resumed);
      expect(completed.status).toBe('COMPLETED');
    });

    it('should complete lifecycle with confirmation: IDLE → ACTIVE → PAUSED → AWAITING → ACTIVE → COMPLETED', () => {
      const session = createTestSession();

      const active = startSession(session);
      const paused = pauseForQuestion(active, createTestCheckpoint());
      const awaiting = awaitConfirmation(paused);
      expect(awaiting.status).toBe('AWAITING_CONFIRMATION');

      const resumed = resumeSession(awaiting);
      const completed = completeSession(resumed);
      expect(completed.status).toBe('COMPLETED');
    });

    it('should handle idle pause: IDLE → ACTIVE → PAUSED_IDLE → ACTIVE → COMPLETED', () => {
      const session = createTestSession();

      const active = startSession(session);
      const pausedIdle = pauseIdle(active);
      expect(pausedIdle.status).toBe('PAUSED_IDLE');

      const resumed = resumeSession(pausedIdle);
      const completed = completeSession(resumed);
      expect(completed.status).toBe('COMPLETED');
    });
  });

  // ==================== Terminal States ====================

  describe('Terminal States', () => {
    it('should identify COMPLETED as terminal', () => {
      expect(isTerminalStatus('COMPLETED')).toBe(true);
    });

    it('should identify ESCALATED as terminal', () => {
      expect(isTerminalStatus('ESCALATED')).toBe(true);
    });

    it('should not allow transitions from COMPLETED', () => {
      const session = createTestSession({ status: 'COMPLETED' });

      expect(() => startSession(session)).toThrow(AppError);
      expect(() => startSession(session)).toThrow(/Invalid session transition/);
    });

    it('should not allow transitions from ESCALATED', () => {
      const session = createTestSession({ status: 'ESCALATED' });

      expect(() => startSession(session)).toThrow(AppError);
      expect(() => resumeSession(session)).toThrow(AppError);
    });
  });

  // ==================== Invalid Transitions ====================

  describe('Invalid Transitions', () => {
    it('should throw AppError for invalid transition IDLE → COMPLETED', () => {
      const session = createTestSession({ status: 'IDLE' });

      expect(() => completeSession(session)).toThrow(AppError);
      expect(() => completeSession(session)).toThrow(/Invalid session transition/);
    });

    it('should throw AppError for invalid transition PAUSED_FOR_QUESTION → PAUSED_IDLE', () => {
      const session = createTestSession({ status: 'PAUSED_FOR_QUESTION' });

      expect(() => pauseIdle(session)).toThrow(AppError);
    });

    it('should include error details in AppError', () => {
      const session = createTestSession({ status: 'IDLE' });

      try {
        completeSession(session);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.code).toBe(ErrorCodes.CLASS_STATE_ERROR);
        expect(appError.httpStatus).toBe(409);
        expect(appError.message).toContain('IDLE');
        expect(appError.message).toContain('COMPLETED');
      }
    });
  });

  // ==================== State Transition Matrix ====================

  describe('State Transition Matrix', () => {
    it('should validate all defined transitions', () => {
      // Test IDLE transitions
      expect(() => validateSessionTransition('IDLE', 'ACTIVE')).not.toThrow();

      // Test ACTIVE transitions
      expect(() => validateSessionTransition('ACTIVE', 'PAUSED_FOR_QUESTION')).not.toThrow();
      expect(() => validateSessionTransition('ACTIVE', 'PAUSED_IDLE')).not.toThrow();
      expect(() => validateSessionTransition('ACTIVE', 'COMPLETED')).not.toThrow();
      expect(() => validateSessionTransition('ACTIVE', 'ESCALATED')).not.toThrow();

      // Test PAUSED_FOR_QUESTION transitions
      expect(() =>
        validateSessionTransition('PAUSED_FOR_QUESTION', 'AWAITING_CONFIRMATION'),
      ).not.toThrow();
      expect(() => validateSessionTransition('PAUSED_FOR_QUESTION', 'ACTIVE')).not.toThrow();
      expect(() => validateSessionTransition('PAUSED_FOR_QUESTION', 'ESCALATED')).not.toThrow();

      // Test AWAITING_CONFIRMATION transitions
      expect(() => validateSessionTransition('AWAITING_CONFIRMATION', 'ACTIVE')).not.toThrow();
      expect(() => validateSessionTransition('AWAITING_CONFIRMATION', 'COMPLETED')).not.toThrow();
      expect(() => validateSessionTransition('AWAITING_CONFIRMATION', 'ESCALATED')).not.toThrow();

      // Test PAUSED_IDLE transitions
      expect(() => validateSessionTransition('PAUSED_IDLE', 'ACTIVE')).not.toThrow();
      expect(() => validateSessionTransition('PAUSED_IDLE', 'COMPLETED')).not.toThrow();
    });

    it('should have correct transition matrix', () => {
      expect(SESSION_TRANSITIONS.IDLE).toEqual(['ACTIVE']);
      expect(SESSION_TRANSITIONS.ACTIVE).toContain('PAUSED_FOR_QUESTION');
      expect(SESSION_TRANSITIONS.ACTIVE).toContain('COMPLETED');
      expect(SESSION_TRANSITIONS.COMPLETED).toEqual([]);
      expect(SESSION_TRANSITIONS.ESCALATED).toEqual([]);
    });
  });

  // ==================== Escalation ====================

  describe('Session Escalation', () => {
    it('should escalate from ACTIVE', () => {
      const session = createTestSession({ status: 'ACTIVE' });
      const escalated = escalateSession(session);

      expect(escalated.status).toBe('ESCALATED');
      expect(escalated.escalatedAt).toBeInstanceOf(Date);
    });

    it('should escalate from PAUSED_FOR_QUESTION', () => {
      const session = createTestSession({ status: 'PAUSED_FOR_QUESTION' });
      const escalated = escalateSession(session);

      expect(escalated.status).toBe('ESCALATED');
    });

    it('should escalate from AWAITING_CONFIRMATION', () => {
      const session = createTestSession({ status: 'AWAITING_CONFIRMATION' });
      const escalated = escalateSession(session);

      expect(escalated.status).toBe('ESCALATED');
    });

    it('should not escalate from IDLE', () => {
      const session = createTestSession({ status: 'IDLE' });

      expect(() => escalateSession(session)).toThrow(AppError);
    });

    it('should not escalate from COMPLETED', () => {
      const session = createTestSession({ status: 'COMPLETED' });

      expect(() => escalateSession(session)).toThrow(AppError);
    });
  });

  // ==================== Checkpoint Management ====================

  describe('Checkpoint Management', () => {
    it('should preserve checkpoint during pause', () => {
      const session = createTestSession();
      const checkpoint = createTestCheckpoint({
        currentStepIndex: 5,
        questionCount: 2,
      });

      const active = startSession(session);
      const paused = pauseForQuestion(active, checkpoint);

      expect(paused.stateCheckpoint.currentStepIndex).toBe(5);
      expect(paused.stateCheckpoint.questionCount).toBe(2);
    });

    it('should update lastActivityAt on transitions', () => {
      const session = createTestSession();
      const before = session.lastActivityAt;

      // Small delay to ensure time difference
      const active = startSession(session);

      expect(active.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
