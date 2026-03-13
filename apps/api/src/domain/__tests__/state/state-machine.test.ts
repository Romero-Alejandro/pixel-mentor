import {
  getNextState,
  attemptTransition,
  InvalidTransitionError,
  getAllowedTransitions,
  isTransitionAllowed,
} from '@/domain/state/state-machine';

describe('StateMachine', () => {
  describe('getNextState', () => {
    it('should transition from ACTIVE_CLASS to RESOLVING_DOUBT on RAISE_HAND', () => {
      const next = getNextState('ACTIVE_CLASS', { type: 'RAISE_HAND' });
      expect(next).toBe('RESOLVING_DOUBT');
    });

    it('should stay in ACTIVE_CLASS on CONTINUE', () => {
      const next = getNextState('ACTIVE_CLASS', { type: 'CONTINUE' });
      expect(next).toBe('ACTIVE_CLASS');
    });

    it('should transition from ACTIVE_CLASS to QUESTION on ASK_QUESTION', () => {
      const next = getNextState('ACTIVE_CLASS', { type: 'ASK_QUESTION' });
      expect(next).toBe('QUESTION');
    });

    it('should transition from ACTIVE_CLASS to CLARIFYING on CLARIFY', () => {
      const next = getNextState('ACTIVE_CLASS', { type: 'CLARIFY' });
      expect(next).toBe('CLARIFYING');
    });

    it('should transition from RESOLVING_DOUBT to ACTIVE_CLASS on RESUME_CLASS', () => {
      const next = getNextState('RESOLVING_DOUBT', { type: 'RESUME_CLASS' });
      expect(next).toBe('ACTIVE_CLASS');
    });

    it('should transition from CLARIFYING to ACTIVE_CLASS on RESUME_CLASS', () => {
      const next = getNextState('CLARIFYING', { type: 'RESUME_CLASS' });
      expect(next).toBe('ACTIVE_CLASS');
    });

    it('should transition from QUESTION to EVALUATION on ANSWER', () => {
      const next = getNextState('QUESTION', { type: 'ANSWER', answer: 'test' });
      expect(next).toBe('EVALUATION');
    });

    it('should transition from EVALUATION to QUESTION on ADVANCE', () => {
      const next = getNextState('EVALUATION', { type: 'ADVANCE' });
      expect(next).toBe('QUESTION');
    });

    it('should transition from EVALUATION to COMPLETED on COMPLETE', () => {
      const next = getNextState('EVALUATION', { type: 'COMPLETE' });
      expect(next).toBe('COMPLETED');
    });

    it('should transition from EVALUATION to ACTIVE_CLASS on VALIDATE', () => {
      const next = getNextState('EVALUATION', { type: 'VALIDATE' });
      expect(next).toBe('ACTIVE_CLASS');
    });

    it('should transition from EXPLANATION to QUESTION on EXPLAIN', () => {
      const next = getNextState('EXPLANATION', { type: 'EXPLAIN', conceptIndex: 0 });
      expect(next).toBe('QUESTION');
    });

    it('should return same state for unknown transition', () => {
      const next = getNextState('ACTIVE_CLASS', { type: 'UNKNOWN' as any });
      expect(next).toBe('ACTIVE_CLASS');
    });
  });

  describe('attemptTransition', () => {
    it('should throw InvalidTransitionError for disallowed transition', () => {
      expect(() => attemptTransition('EXPLANATION', { type: 'ANSWER', answer: 'test' })).toThrow(
        InvalidTransitionError,
      );
    });

    it('should succeed for allowed transition', () => {
      const next = attemptTransition('ACTIVE_CLASS', { type: 'RAISE_HAND' });
      expect(next).toBe('RESOLVING_DOUBT');
    });
  });

  describe('isTransitionAllowed', () => {
    it('should return true for valid transitions', () => {
      expect(isTransitionAllowed('ACTIVE_CLASS', 'RAISE_HAND')).toBe(true);
      expect(isTransitionAllowed('ACTIVE_CLASS', 'CONTINUE')).toBe(true);
      expect(isTransitionAllowed('RESOLVING_DOUBT', 'RESUME_CLASS')).toBe(true);
      expect(isTransitionAllowed('CLARIFYING', 'RESUME_CLASS')).toBe(true);
      expect(isTransitionAllowed('QUESTION', 'ANSWER')).toBe(true);
      expect(isTransitionAllowed('EVALUATION', 'ADVANCE')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(isTransitionAllowed('ACTIVE_CLASS', 'ANSWER')).toBe(false);
      expect(isTransitionAllowed('QUESTION', 'RAISE_HAND')).toBe(false);
      expect(isTransitionAllowed('COMPLETED', 'CONTINUE')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return correct events for ACTIVE_CLASS', () => {
      const events = getAllowedTransitions('ACTIVE_CLASS');
      expect(events).toContain('RAISE_HAND');
      expect(events).toContain('CONTINUE');
      expect(events).toContain('ASK_QUESTION');
      expect(events).toContain('CLARIFY');
    });

    it('should return correct events for RESOLVING_DOUBT', () => {
      const events = getAllowedTransitions('RESOLVING_DOUBT');
      expect(events).toContain('RESUME_CLASS');
    });

    it('should return correct events for CLARIFYING', () => {
      const events = getAllowedTransitions('CLARIFYING');
      expect(events).toContain('RESUME_CLASS');
    });

    it('should return correct events for QUESTION', () => {
      const events = getAllowedTransitions('QUESTION');
      expect(events).toContain('ANSWER');
    });

    it('should return correct events for EVALUATION', () => {
      const events = getAllowedTransitions('EVALUATION');
      expect(events).toContain('ADVANCE');
      expect(events).toContain('COMPLETE');
      expect(events).toContain('VALIDATE');
    });

    it('should return correct events for EXPLANATION', () => {
      const events = getAllowedTransitions('EXPLANATION');
      expect(events).toContain('EXPLAIN');
    });

    it('should return empty array for COMPLETED', () => {
      const events = getAllowedTransitions('COMPLETED');
      expect(events).toEqual([]);
    });
  });
});
