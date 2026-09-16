import {
  detectNavigationInput,
  calculateNextStep,
  determineStepTransition,
} from '@/features/recipe/application/services/navigation.service.js';
import type { RecipeStep } from '@/features/recipe/domain/entities/recipe.entity.js';

// Mock logger
jest.mock('@/shared/logger/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

const makeStep = (
  overrides: Partial<RecipeStep> & Pick<RecipeStep, 'atomId' | 'stepType' | 'order'>,
): RecipeStep => ({
  id: `step-${overrides.order ?? 0}`,
  recipeId: 'recipe-1',
  createdAt: new Date('2023-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('NavigationService', () => {
  describe('detectNavigationInput', () => {
    it('should detect __auto__ as navigation', () => {
      const result = detectNavigationInput('__auto__', 'EXPLANATION');
      expect(result.isNavigation).toBe(true);
      expect(result.normalizedInput).toBe('__auto__');
    });

    it('should detect continuar as navigation', () => {
      expect(detectNavigationInput('continuar', 'EXPLANATION').isNavigation).toBe(true);
    });

    it('should detect siguiente as navigation', () => {
      expect(detectNavigationInput('siguiente', 'EXPLANATION').isNavigation).toBe(true);
    });

    it('should detect next as navigation', () => {
      expect(detectNavigationInput('next', 'EXPLANATION').isNavigation).toBe(true);
    });

    it('should detect ok as navigation', () => {
      expect(detectNavigationInput('ok', 'EXPLANATION').isNavigation).toBe(true);
    });

    it('should detect dale as navigation', () => {
      expect(detectNavigationInput('dale', 'EXPLANATION').isNavigation).toBe(true);
    });

    it('should detect vamos as navigation', () => {
      expect(detectNavigationInput('vamos', 'EXPLANATION').isNavigation).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(detectNavigationInput('CONTINUAR', 'EXPLANATION').isNavigation).toBe(true);
      expect(detectNavigationInput('Continuar', 'EXPLANATION').isNavigation).toBe(true);
    });

    it('should handle whitespace around input', () => {
      expect(detectNavigationInput('  continuar  ', 'EXPLANATION').isNavigation).toBe(true);
    });

    it('should not detect random text as navigation', () => {
      expect(detectNavigationInput('Paris es la capital', 'EXPLANATION').isNavigation).toBe(false);
    });

    it('should not detect empty input as navigation', () => {
      expect(detectNavigationInput('', 'EXPLANATION').isNavigation).toBe(false);
    });

    it('should block navigation in ACTIVITY_WAIT state', () => {
      const result = detectNavigationInput('continuar', 'ACTIVITY_WAIT');
      expect(result.isNavigation).toBe(false);
    });

    it('should block navigation in RESOLVING_DOUBT state', () => {
      const result = detectNavigationInput('continuar', 'RESOLVING_DOUBT');
      expect(result.isNavigation).toBe(false);
    });

    it('should block navigation in CLARIFYING state', () => {
      const result = detectNavigationInput('continuar', 'CLARIFYING');
      expect(result.isNavigation).toBe(false);
    });

    it('should allow navigation in EXPLANATION state', () => {
      expect(detectNavigationInput('continuar', 'EXPLANATION').isNavigation).toBe(true);
    });

    it('should allow navigation in AWAITING_START state', () => {
      expect(detectNavigationInput('ok', 'AWAITING_START').isNavigation).toBe(true);
    });

    it('should allow navigation in EVALUATION state', () => {
      expect(detectNavigationInput('continuar', 'EVALUATION').isNavigation).toBe(true);
    });

    it('should always return normalizedInput regardless of navigation', () => {
      const result = detectNavigationInput('  Hello World  ', 'EXPLANATION');
      expect(result.normalizedInput).toBe('hello world');
    });
  });

  describe('calculateNextStep', () => {
    const steps = [
      makeStep({ atomId: 'a1', stepType: 'intro', order: 0, script: {} }),
      makeStep({ atomId: 'a2', stepType: 'content', order: 1, script: {} }),
      makeStep({ atomId: 'a3', stepType: 'question', order: 2, script: {} }),
      makeStep({ atomId: 'a4', stepType: 'activity', order: 3, script: {} }),
      makeStep({ atomId: 'a5', stepType: 'closure', order: 4, script: {} }),
    ];

    it('should return next step when not at end', () => {
      const result = calculateNextStep(steps, 0);
      expect(result.nextStepIndex).toBe(1);
      expect(result.nextStep).toBe(steps[1]);
      expect(result.willComplete).toBe(false);
    });

    it('should return null when at the end', () => {
      const result = calculateNextStep(steps, 4);
      expect(result.nextStepIndex).toBeNull();
      expect(result.nextStep).toBeUndefined();
      expect(result.willComplete).toBe(true);
    });

    it('should handle single step array', () => {
      const singleStep = [makeStep({ atomId: 'a1', stepType: 'content', order: 0, script: {} })];
      const result = calculateNextStep(singleStep, 0);
      expect(result.willComplete).toBe(true);
    });
  });

  describe('determineStepTransition', () => {
    it('should return ACTIVITY_WAIT for activity step', () => {
      const result = determineStepTransition(
        makeStep({ atomId: 'a1', stepType: 'activity', order: 0, script: {} }),
      );
      expect(result.targetState).toBe('ACTIVITY_WAIT');
      expect(result.requiresInput).toBe(true);
      expect(result.autoAdvance).toBe(false);
    });

    it('should return ACTIVITY_WAIT for exam step', () => {
      // 'exam' is handled defensively by the service even though it's not in the domain StepType union
      const result = determineStepTransition(
        makeStep({
          atomId: 'a1',
          stepType: 'exam' as RecipeStep['stepType'],
          order: 0,
          script: {},
        }),
      );
      expect(result.targetState).toBe('ACTIVITY_WAIT');
      expect(result.requiresInput).toBe(true);
    });

    it('should return ACTIVITY_WAIT for question step', () => {
      const result = determineStepTransition(
        makeStep({ atomId: 'a1', stepType: 'question', order: 0, script: {} }),
      );
      expect(result.targetState).toBe('ACTIVITY_WAIT');
      expect(result.requiresInput).toBe(true);
    });

    it('should return EXPLANATION for content step', () => {
      const result = determineStepTransition(
        makeStep({ atomId: 'a1', stepType: 'content', order: 0, script: {} }),
      );
      expect(result.targetState).toBe('EXPLANATION');
      expect(result.requiresInput).toBe(false);
      expect(result.autoAdvance).toBe(true);
    });

    it('should return EXPLANATION for intro step', () => {
      const result = determineStepTransition(
        makeStep({ atomId: 'a1', stepType: 'intro', order: 0, script: {} }),
      );
      expect(result.targetState).toBe('EXPLANATION');
      expect(result.requiresInput).toBe(false);
    });

    it('should return EXPLANATION for closure step', () => {
      const result = determineStepTransition(
        makeStep({ atomId: 'a1', stepType: 'closure', order: 0, script: {} }),
      );
      expect(result.targetState).toBe('EXPLANATION');
      expect(result.requiresInput).toBe(false);
    });

    it('should default to EXPLANATION for null stepType', () => {
      const result = determineStepTransition(
        makeStep({ atomId: 'a1', stepType: undefined, order: 0, script: {} }),
      );
      expect(result.targetState).toBe('EXPLANATION');
      expect(result.requiresInput).toBe(false);
    });
  });
});
