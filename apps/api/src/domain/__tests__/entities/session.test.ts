import { createSession, startSession, completeSession } from '@/domain/entities/session';

describe('Session Entity', () => {
  it('should create a valid session', () => {
    const session = createSession({
      id: 'session-123',
      studentId: 'student-456',
      lessonId: 'lesson-789',
      stateCheckpoint: {},
    });

    expect(session.id).toBe('session-123');
    expect(session.studentId).toBe('student-456');
    expect(session.lessonId).toBe('lesson-789');
    expect(session.status).toBe('idle');
    expect(session.version).toBe(1);
  });

  it('should validate session status transitions', () => {
    let session = createSession({
      id: 'session-123',
      studentId: 'student-456',
      lessonId: 'lesson-789',
      stateCheckpoint: {},
    });

    session = startSession(session);
    expect(session.status).toBe('active');

    session = completeSession(session);
    expect(session.status).toBe('completed');
    expect(session.completedAt).toBeInstanceOf(Date);
  });
});
