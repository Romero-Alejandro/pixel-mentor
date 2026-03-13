import {
  createSession,
  startSession,
  completeSession,
  escalateSession,
  pauseForQuestion,
  awaitConfirmation,
  pauseIdle,
  resumeSession,
  setCurrentInteraction,
  incrementVersion,
} from '@/domain/entities/session';
import type { SessionCheckpoint } from '@/domain/entities/session';

describe('Session Entity', () => {
  const baseSessionParams = {
    id: 'session-123',
    studentId: 'student-456',
    lessonId: 'lesson-789',
  };

  it('should create a valid session with default values', () => {
    const session = createSession(baseSessionParams);

    expect(session.id).toBe('session-123');
    expect(session.studentId).toBe('student-456');
    expect(session.lessonId).toBe('lesson-789');
    expect(session.status).toBe('idle');
    expect(session.version).toBe(1);
    expect(session.safetyFlag).toBeNull();
    expect(session.outOfScope).toBe(false);
    expect(session.failedAttempts).toBe(0);
    expect(session.stateCheckpoint.currentState).toBe('ACTIVE_CLASS');
    expect(session.stateCheckpoint.currentSegmentIndex).toBe(0);
    expect(session.stateCheckpoint.currentQuestionIndex).toBe(0);
  });

  it('should create a session with custom safety flags and failed attempts', () => {
    const checkpoint: SessionCheckpoint = {
      currentState: 'QUESTION',
      currentSegmentIndex: 1,
      currentQuestionIndex: 2,
    };
    const session = createSession({
      ...baseSessionParams,
      stateCheckpoint: checkpoint,
      safetyFlag: 'inappropriate_content',
      outOfScope: true,
      failedAttempts: 2,
    });

    expect(session.safetyFlag).toBe('inappropriate_content');
    expect(session.outOfScope).toBe(true);
    expect(session.failedAttempts).toBe(2);
    expect(session.stateCheckpoint.currentState).toBe('QUESTION');
    expect(session.stateCheckpoint.currentSegmentIndex).toBe(1);
  });

  it('should validate session status transitions', () => {
    let session = createSession(baseSessionParams);

    session = startSession(session);
    expect(session.status).toBe('active');

    session = completeSession(session);
    expect(session.status).toBe('completed');
    expect(session.completedAt).toBeInstanceOf(Date);
  });

  it('should escalate a session', () => {
    let session = createSession(baseSessionParams);
    session = escalateSession(session);

    expect(session.status).toBe('escalated');
    expect(session.escalatedAt).toBeInstanceOf(Date);
  });

  it('should pause for question', () => {
    let session = createSession(baseSessionParams);
    const checkpoint: SessionCheckpoint = {
      currentState: 'ACTIVE_CLASS',
      currentSegmentIndex: 1,
      currentQuestionIndex: 0,
    };
    session = pauseForQuestion(session, checkpoint);

    expect(session.status).toBe('paused_for_question');
    expect(session.stateCheckpoint).toEqual(checkpoint);
  });

  it('should await confirmation', () => {
    let session = createSession(baseSessionParams);
    session = awaitConfirmation(session);

    expect(session.status).toBe('awaiting_confirmation');
  });

  it('should pause idle', () => {
    let session = createSession(baseSessionParams);
    session = pauseIdle(session);

    expect(session.status).toBe('paused_idle');
  });

  it('should resume session', () => {
    let session = createSession(baseSessionParams);
    session = pauseIdle(session);
    session = resumeSession(session);

    expect(session.status).toBe('active');
  });

  it('should set current interaction', () => {
    let session = createSession(baseSessionParams);
    session = setCurrentInteraction(session, 'interaction-123');

    expect(session.currentInteractionId).toBe('interaction-123');
    expect(session.lastActivityAt).toBeInstanceOf(Date);
  });

  it('should increment version', () => {
    let session = createSession(baseSessionParams);
    session = incrementVersion(session);

    expect(session.version).toBe(2);
  });
});
