import {
  getNextState,
  attemptTransition,
  InvalidTransitionError,
  getAllowedTransitions,
  isTransitionAllowed,
} from '@/domain/state/state-machine';
import { PedagogicalState } from '@/domain/entities/pedagogical-state';

describe('StateMachine', () => {
  it('should initialize with correct initial state', () => {
    const initialState: PedagogicalState = 'EXPLANATION';
    expect(initialState).toBe('EXPLANATION');
  });

  it('should transition to explanation state', () => {
    const currentState: PedagogicalState = 'EXPLANATION';
    const nextState = getNextState(currentState, { type: 'EXPLAIN', conceptIndex: 0 });
    expect(nextState).toBe('QUESTION');
  });

  it('should transition to practice state', () => {
    const currentState: PedagogicalState = 'QUESTION';
    const nextState = getNextState(currentState, { type: 'ANSWER', answer: 'test' });
    expect(nextState).toBe('EVALUATION');
  });

  it('should transition to evaluation state', () => {
    const currentState: PedagogicalState = 'EVALUATION';
    const nextState = getNextState(currentState, { type: 'ADVANCE' });
    expect(nextState).toBe('QUESTION');
  });

  it('should transition to completion state', () => {
    const currentState: PedagogicalState = 'EVALUATION';
    const nextState = getNextState(currentState, { type: 'COMPLETE' });
    expect(nextState).toBe('EVALUATION');
  });

  it('should not allow invalid transitions', () => {
    const currentState: PedagogicalState = 'EXPLANATION';
    expect(() => attemptTransition(currentState, { type: 'ANSWER', answer: 'test' })).toThrow(
      InvalidTransitionError,
    );
  });

  it('should get allowed transitions', () => {
    const currentState: PedagogicalState = 'EXPLANATION';
    const transitions = getAllowedTransitions(currentState);
    expect(transitions.length).toBeGreaterThan(0);
  });

  it('should check if transition is allowed', () => {
    const currentState: PedagogicalState = 'EXPLANATION';
    const isAllowed = isTransitionAllowed(currentState, 'EXPLAIN');
    expect(isAllowed).toBe(true);
  });
});
