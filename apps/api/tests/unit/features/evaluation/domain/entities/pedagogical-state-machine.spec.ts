import {
  getNextState,
  getAllowedTransitions,
  isTransitionAllowed,
  attemptTransition,
  InvalidTransitionError,
  PedagogicalStateMachine,
  PEDAGOGICAL_STATES,
  type PedagogicalState,
} from '@/features/evaluation/domain/entities/pedagogical-state-machine.js';

describe('PedagogicalStateMachine', () => {
  describe('State Transitions', () => {
    describe('ACTIVITY_WAIT transitions (CRITICAL: Fix for wrong answer staying in ACTIVITY_WAIT)', () => {
      it('should transition from ACTIVITY_WAIT to EVALUATION on EVALUATE_CORRECT', () => {
        const nextState = getNextState('ACTIVITY_WAIT', { type: 'EVALUATE_CORRECT' });
        expect(nextState).toBe('EVALUATION');
      });

      it('should transition from ACTIVITY_WAIT to ACTIVITY_WAIT on EVALUATE_INCORRECT (stays for retry)', () => {
        const nextState = getNextState('ACTIVITY_WAIT', { type: 'EVALUATE_INCORRECT' });
        expect(nextState).toBe('ACTIVITY_WAIT');
      });

      it('should transition from ACTIVITY_WAIT to ACTIVITY_INACTIVITY_WARNING on SHOW_ENCOURAGEMENT', () => {
        const nextState = getNextState('ACTIVITY_WAIT', { type: 'SHOW_ENCOURAGEMENT' });
        expect(nextState).toBe('ACTIVITY_INACTIVITY_WARNING');
      });

      it('should transition from ACTIVITY_WAIT to ACTIVITY_SKIP_OFFER on ACTIVITY_TIMEOUT', () => {
        const nextState = getNextState('ACTIVITY_WAIT', { type: 'ACTIVITY_TIMEOUT' });
        expect(nextState).toBe('ACTIVITY_SKIP_OFFER');
      });
    });

    describe('ACTIVITY_INACTIVITY_WARNING transitions', () => {
      it('should transition from ACTIVITY_INACTIVITY_WARNING to EVALUATION on EVALUATE_CORRECT', () => {
        const nextState = getNextState('ACTIVITY_INACTIVITY_WARNING', { type: 'EVALUATE_CORRECT' });
        expect(nextState).toBe('EVALUATION');
      });

      it('should transition from ACTIVITY_INACTIVITY_WARNING to ACTIVITY_WAIT on EVALUATE_INCORRECT', () => {
        const nextState = getNextState('ACTIVITY_INACTIVITY_WARNING', {
          type: 'EVALUATE_INCORRECT',
        });
        expect(nextState).toBe('ACTIVITY_WAIT');
      });

      it('should transition from ACTIVITY_INACTIVITY_WARNING to ACTIVITY_SKIP_OFFER on ACTIVITY_TIMEOUT', () => {
        const nextState = getNextState('ACTIVITY_INACTIVITY_WARNING', { type: 'ACTIVITY_TIMEOUT' });
        expect(nextState).toBe('ACTIVITY_SKIP_OFFER');
      });
    });

    describe('EVALUATION transitions', () => {
      it('should transition from EVALUATION to EXPLANATION on ADVANCE', () => {
        const nextState = getNextState('EVALUATION', { type: 'ADVANCE' });
        expect(nextState).toBe('EXPLANATION');
      });

      it('should transition from EVALUATION to COMPLETED on COMPLETE', () => {
        const nextState = getNextState('EVALUATION', { type: 'COMPLETE' });
        expect(nextState).toBe('COMPLETED');
      });

      it('should transition from EVALUATION to ACTIVITY_SKIP_OFFER on OFFER_SKIP', () => {
        const nextState = getNextState('EVALUATION', { type: 'OFFER_SKIP' });
        expect(nextState).toBe('ACTIVITY_SKIP_OFFER');
      });

      it('should stay in EVALUATION on EVALUATE_CORRECT (re-answer correctly)', () => {
        const nextState = getNextState('EVALUATION', { type: 'EVALUATE_CORRECT' });
        expect(nextState).toBe('EVALUATION');
      });

      it('should stay in EVALUATION on EVALUATE_INCORRECT (re-answer incorrectly)', () => {
        const nextState = getNextState('EVALUATION', { type: 'EVALUATE_INCORRECT' });
        expect(nextState).toBe('EVALUATION');
      });

      it('should transition from EVALUATION to ACTIVITY_WAIT on EVALUATE_PARTIAL', () => {
        const nextState = getNextState('EVALUATION', { type: 'EVALUATE_PARTIAL' });
        expect(nextState).toBe('ACTIVITY_WAIT');
      });
    });

    describe('ACTIVITY_SKIP_OFFER transitions', () => {
      it('should transition from ACTIVITY_SKIP_OFFER to EXPLANATION on REPEAT_CONCEPT', () => {
        const nextState = getNextState('ACTIVITY_SKIP_OFFER', { type: 'REPEAT_CONCEPT' });
        expect(nextState).toBe('EXPLANATION');
      });

      it('should transition from ACTIVITY_SKIP_OFFER to EXPLANATION on SKIP_ACTIVITY', () => {
        const nextState = getNextState('ACTIVITY_SKIP_OFFER', { type: 'SKIP_ACTIVITY' });
        expect(nextState).toBe('EXPLANATION');
      });

      it('should transition from ACTIVITY_SKIP_OFFER to EXPLANATION on CONTINUE', () => {
        const nextState = getNextState('ACTIVITY_SKIP_OFFER', { type: 'CONTINUE' });
        expect(nextState).toBe('EXPLANATION');
      });
    });

    describe('AWAITING_START transitions', () => {
      it('should transition from AWAITING_START to EXPLANATION on START_CLASS', () => {
        const nextState = getNextState('AWAITING_START', { type: 'START_CLASS' });
        expect(nextState).toBe('EXPLANATION');
      });

      it('should stay in AWAITING_START on RESTART_CLASS', () => {
        const nextState = getNextState('AWAITING_START', { type: 'RESTART_CLASS' });
        expect(nextState).toBe('AWAITING_START');
      });
    });

    describe('COMPLETED transitions', () => {
      it('should transition from COMPLETED to AWAITING_START on RESTART_CLASS', () => {
        const nextState = getNextState('COMPLETED', { type: 'RESTART_CLASS' });
        expect(nextState).toBe('AWAITING_START');
      });
    });

    describe('ACTIVE_CLASS transitions', () => {
      it('should transition from ACTIVE_CLASS to RESOLVING_DOUBT on RAISE_HAND', () => {
        const nextState = getNextState('ACTIVE_CLASS', { type: 'RAISE_HAND' });
        expect(nextState).toBe('RESOLVING_DOUBT');
      });

      it('should stay in ACTIVE_CLASS on CONTINUE', () => {
        const nextState = getNextState('ACTIVE_CLASS', { type: 'CONTINUE' });
        expect(nextState).toBe('ACTIVE_CLASS');
      });

      it('should transition from ACTIVE_CLASS to QUESTION on ASK_QUESTION', () => {
        const nextState = getNextState('ACTIVE_CLASS', { type: 'ASK_QUESTION' });
        expect(nextState).toBe('QUESTION');
      });

      it('should transition from ACTIVE_CLASS to CLARIFYING on CLARIFY', () => {
        const nextState = getNextState('ACTIVE_CLASS', { type: 'CLARIFY' });
        expect(nextState).toBe('CLARIFYING');
      });

      it('should transition from ACTIVE_CLASS to EXPLANATION on EXPLAIN', () => {
        const nextState = getNextState('ACTIVE_CLASS', { type: 'EXPLAIN' });
        expect(nextState).toBe('EXPLANATION');
      });
    });

    describe('EXPLANATION transitions', () => {
      it('should transition from EXPLANATION to RESOLVING_DOUBT on RAISE_HAND', () => {
        const nextState = getNextState('EXPLANATION', { type: 'RAISE_HAND' });
        expect(nextState).toBe('RESOLVING_DOUBT');
      });

      it('should transition from EXPLANATION to CLARIFYING on CLARIFY', () => {
        const nextState = getNextState('EXPLANATION', { type: 'CLARIFY' });
        expect(nextState).toBe('CLARIFYING');
      });

      it('should stay in EXPLANATION on CONTINUE', () => {
        const nextState = getNextState('EXPLANATION', { type: 'CONTINUE' });
        expect(nextState).toBe('EXPLANATION');
      });

      it('should transition from EXPLANATION to EXPLANATION on ADVANCE', () => {
        const nextState = getNextState('EXPLANATION', { type: 'ADVANCE' });
        expect(nextState).toBe('EXPLANATION');
      });

      it('should transition from EXPLANATION to COMPLETED on COMPLETE', () => {
        const nextState = getNextState('EXPLANATION', { type: 'COMPLETE' });
        expect(nextState).toBe('COMPLETED');
      });

      it('should transition from EXPLANATION to ACTIVITY_INACTIVITY_WARNING on ACTIVITY_TIMEOUT', () => {
        const nextState = getNextState('EXPLANATION', { type: 'ACTIVITY_TIMEOUT' });
        expect(nextState).toBe('ACTIVITY_INACTIVITY_WARNING');
      });
    });

    describe('RESOLVING_DOUBT transitions', () => {
      it('should transition from RESOLVING_DOUBT to EXPLANATION on RESUME_CLASS', () => {
        const nextState = getNextState('RESOLVING_DOUBT', { type: 'RESUME_CLASS' });
        expect(nextState).toBe('EXPLANATION');
      });

      it('should transition from RESOLVING_DOUBT to EXPLANATION on QUESTION_COOLDOWN', () => {
        const nextState = getNextState('RESOLVING_DOUBT', { type: 'QUESTION_COOLDOWN' });
        expect(nextState).toBe('EXPLANATION');
      });
    });

    describe('CLARIFYING transitions', () => {
      it('should transition from CLARIFYING to EXPLANATION on RESUME_CLASS', () => {
        const nextState = getNextState('CLARIFYING', { type: 'RESUME_CLASS' });
        expect(nextState).toBe('EXPLANATION');
      });
    });

    describe('QUESTION transitions', () => {
      it('should transition from QUESTION to EVALUATION on EVALUATE_CORRECT', () => {
        const nextState = getNextState('QUESTION', { type: 'EVALUATE_CORRECT' });
        expect(nextState).toBe('EVALUATION');
      });

      it('should transition from QUESTION to EVALUATION on EVALUATE_INCORRECT', () => {
        const nextState = getNextState('QUESTION', { type: 'EVALUATE_INCORRECT' });
        expect(nextState).toBe('EVALUATION');
      });

      it('should transition from QUESTION to EVALUATION on EVALUATE_PARTIAL', () => {
        const nextState = getNextState('QUESTION', { type: 'EVALUATE_PARTIAL' });
        expect(nextState).toBe('EVALUATION');
      });

      it('should transition from QUESTION to RESOLVING_DOUBT on RAISE_HAND', () => {
        const nextState = getNextState('QUESTION', { type: 'RAISE_HAND' });
        expect(nextState).toBe('RESOLVING_DOUBT');
      });
    });

    describe('Invalid transitions', () => {
      it('should stay in current state when transition is invalid', () => {
        const nextState = getNextState('ACTIVITY_WAIT', { type: 'ADVANCE' });
        expect(nextState).toBe('ACTIVITY_WAIT');
      });

      it('should stay in EVALUATION when trying invalid transition', () => {
        const nextState = getNextState('EVALUATION', { type: 'START_CLASS' });
        expect(nextState).toBe('EVALUATION');
      });
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return all allowed events for ACTIVITY_WAIT', () => {
      const allowed = getAllowedTransitions('ACTIVITY_WAIT');
      expect(allowed).toContain('EVALUATE_CORRECT');
      expect(allowed).toContain('EVALUATE_INCORRECT');
      expect(allowed).toContain('SHOW_ENCOURAGEMENT');
      expect(allowed).toContain('ACTIVITY_TIMEOUT');
    });

    it('should return all allowed events for EVALUATION', () => {
      const allowed = getAllowedTransitions('EVALUATION');
      expect(allowed).toContain('ADVANCE');
      expect(allowed).toContain('COMPLETE');
      expect(allowed).toContain('OFFER_SKIP');
      expect(allowed).toContain('EVALUATE_CORRECT');
      expect(allowed).toContain('EVALUATE_INCORRECT');
      expect(allowed).toContain('EVALUATE_PARTIAL');
    });
  });

  describe('isTransitionAllowed', () => {
    it('should return true for valid transition', () => {
      const allowed = isTransitionAllowed('ACTIVITY_WAIT', 'EVALUATE_CORRECT');
      expect(allowed).toBe(true);
    });

    it('should return false for invalid transition', () => {
      const allowed = isTransitionAllowed('ACTIVITY_WAIT', 'ADVANCE');
      expect(allowed).toBe(false);
    });
  });

  describe('attemptTransition', () => {
    it('should throw InvalidTransitionError for invalid transition', () => {
      expect(() => {
        attemptTransition('ACTIVITY_WAIT', { type: 'ADVANCE' });
      }).toThrow(InvalidTransitionError);
    });

    it('should return next state for valid transition', () => {
      const nextState = attemptTransition('ACTIVITY_WAIT', { type: 'EVALUATE_CORRECT' });
      expect(nextState).toBe('EVALUATION');
    });
  });

  describe('PedagogicalStateMachine class', () => {
    it('should start with initial state', () => {
      const machine = new PedagogicalStateMachine('ACTIVITY_WAIT');
      expect(machine.getCurrentState()).toBe('ACTIVITY_WAIT');
    });

    it('should transition to new state on valid event', () => {
      const machine = new PedagogicalStateMachine('ACTIVITY_WAIT');
      const newState = machine.transition('EVALUATE_CORRECT');
      expect(newState).toBe('EVALUATION');
      expect(machine.getCurrentState()).toBe('EVALUATION');
    });

    it('should throw on invalid transition', () => {
      const machine = new PedagogicalStateMachine('ACTIVITY_WAIT');
      expect(() => {
        machine.transition('ADVANCE');
      }).toThrow(InvalidTransitionError);
    });

    it('should handle wrong answer staying in ACTIVITY_WAIT', () => {
      const machine = new PedagogicalStateMachine('ACTIVITY_WAIT');
      const newState = machine.transition('EVALUATE_INCORRECT');
      expect(newState).toBe('ACTIVITY_WAIT');
      expect(machine.getCurrentState()).toBe('ACTIVITY_WAIT');
    });
  });

  describe('PEDAGOGICAL_STATES constant', () => {
    it('should contain all expected states', () => {
      expect(PEDAGOGICAL_STATES).toContain('AWAITING_START');
      expect(PEDAGOGICAL_STATES).toContain('ACTIVE_CLASS');
      expect(PEDAGOGICAL_STATES).toContain('RESOLVING_DOUBT');
      expect(PEDAGOGICAL_STATES).toContain('CLARIFYING');
      expect(PEDAGOGICAL_STATES).toContain('EXPLANATION');
      expect(PEDAGOGICAL_STATES).toContain('ACTIVITY_WAIT');
      expect(PEDAGOGICAL_STATES).toContain('ACTIVITY_INACTIVITY_WARNING');
      expect(PEDAGOGICAL_STATES).toContain('ACTIVITY_SKIP_OFFER');
      expect(PEDAGOGICAL_STATES).toContain('QUESTION');
      expect(PEDAGOGICAL_STATES).toContain('EVALUATION');
      expect(PEDAGOGICAL_STATES).toContain('COMPLETED');
    });

    it('should have 11 states', () => {
      expect(PEDAGOGICAL_STATES.length).toBe(11);
    });
  });

  describe('Edge cases and regression tests', () => {
    it('CRITICAL: wrong answer in ACTIVITY_WAIT should NOT go to EVALUATION', () => {
      // This is the main bug we fixed - wrong answer should stay in ACTIVITY_WAIT
      const nextState = getNextState('ACTIVITY_WAIT', { type: 'EVALUATE_INCORRECT' });
      expect(nextState).toBe('ACTIVITY_WAIT');
      expect(nextState).not.toBe('EVALUATION');
    });

    it('CRITICAL: correct answer in ACTIVITY_WAIT should go to EVALUATION', () => {
      // This verifies the correct behavior
      const nextState = getNextState('ACTIVITY_WAIT', { type: 'EVALUATE_CORRECT' });
      expect(nextState).toBe('EVALUATION');
    });

    it('should handle multiple consecutive wrong answers in ACTIVITY_WAIT', () => {
      let state: PedagogicalState = 'ACTIVITY_WAIT';
      // Simulate 3 wrong answers
      for (let i = 0; i < 3; i++) {
        state = getNextState(state, { type: 'EVALUATE_INCORRECT' });
        expect(state).toBe('ACTIVITY_WAIT');
      }
      // After 3 wrong answers + timeout, should go to ACTIVITY_SKIP_OFFER
      state = getNextState(state, { type: 'ACTIVITY_TIMEOUT' });
      expect(state).toBe('ACTIVITY_SKIP_OFFER');
    });

    it('should handle re-answer in EVALUATION staying in EVALUATION', () => {
      // When student is in EVALUATION and gives another answer
      let state = getNextState('EVALUATION', { type: 'EVALUATE_INCORRECT' });
      expect(state).toBe('EVALUATION');

      state = getNextState(state, { type: 'EVALUATE_CORRECT' });
      expect(state).toBe('EVALUATION');
    });

    it('should handle partial answer going to ACTIVITY_WAIT for hints', () => {
      const nextState = getNextState('EVALUATION', { type: 'EVALUATE_PARTIAL' });
      expect(nextState).toBe('ACTIVITY_WAIT');
    });
  });
});
