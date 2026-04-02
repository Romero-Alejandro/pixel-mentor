import {
  RecipeService,
  RecipeNotFoundError,
  RecipeValidationError,
  StepNotFoundError,
} from '@/features/recipe/application/services/recipe.service.js';
import type { RecipeRepository } from '@/features/recipe/domain/ports/recipe.repository.port.js';
import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port.js';
import type { Recipe, RecipeStep, StepScript } from '@/features/recipe/domain/entities/recipe.entity.js'; // Import StepScript
import type { CreateRecipeStepInput } from '@/features/recipe/application/services/recipe.service.js'; // Import DTO for testing

// Jest globals are available automatically - no need to import

// Mock types
const createMockRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 'recipe-123',
  canonicalId: 'test-recipe',
  title: 'Test Recipe',
  description: 'A test description',
  expectedDurationMinutes: 30,
  version: '1.0.0',
  published: false,
  moduleId: 'module-123',
  createdAt: new Date(),
  updatedAt: new Date(),
  steps: [],
  ...overrides,
});

const defaultStepScript: StepScript = {
  transition: { text: 't' },
  content: { text: 'c', chunks: [{ text: 'ch', pauseAfter: 0 }] },
  examples: [],
  closure: { text: 'cl' },
};

const mockStep: RecipeStep = {
  id: 'step-123',
  recipeId: 'recipe-123',
  atomId: 'atom-123',
  order: 0,
  condition: undefined,
  onCondition: undefined,
  createdAt: new Date(),
  stepType: 'content',
  script: defaultStepScript,
};

const mockStep2: RecipeStep = {
  id: 'step-2',
  recipeId: 'recipe-123',
  atomId: 'atom-2',
  order: 1,
  condition: undefined,
  onCondition: undefined,
  createdAt: new Date(),
  stepType: 'content',
  script: defaultStepScript,
};

const mockStep3: RecipeStep = {
  id: 'step-3',
  recipeId: 'recipe-123',
  atomId: 'atom-3',
  order: 2,
  condition: undefined,
  onCondition: undefined,
  createdAt: new Date(),
  stepType: 'content',
  script: defaultStepScript,
};

// Mock RecipeRepository
const createMockRecipeRepository = (): jest.Mocked<RecipeRepository> => {
  const mockRepo: jest.Mocked<RecipeRepository> = {
    findById: jest.fn(),
    findByIdWithSteps: jest.fn(),
    findAll: jest.fn(),
    findPublished: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findStepsByRecipeId: jest.fn(),
    findStepsWithContent: jest.fn(),
    createStep: jest.fn(),
    updateStep: jest.fn(),
    deleteStep: jest.fn(),
    findStepById: jest.fn(),
  };

  mockRepo.findById.mockImplementation((id: string) => {
    return Promise.resolve(createMockRecipe({ id }));
  });

  mockRepo.findByIdWithSteps.mockImplementation((id: string) => {
    return Promise.resolve({
      ...createMockRecipe({ id }),
      steps: id === 'recipe-123' ? [mockStep, mockStep2, mockStep3] : [mockStep],
    });
  });

  mockRepo.findAll.mockResolvedValue([createMockRecipe()]);
  mockRepo.findPublished.mockResolvedValue([createMockRecipe({ published: true })]);

  mockRepo.create.mockImplementation((data: any) => {
    return Promise.resolve(
      createMockRecipe({
        id: crypto.randomUUID(), // Ensure ID is generated
        title: data.title,
        canonicalId: data.canonicalId,
        version: data.version,
      }),
    );
  });

  mockRepo.update.mockImplementation((id: string, data: any) => {
    return Promise.resolve(
      createMockRecipe({
        id,
        ...data,
        version: data.version || '1.0.1',
      }),
    );
  });

  mockRepo.delete.mockResolvedValue(undefined);

  mockRepo.findStepsByRecipeId.mockImplementation((recipeId: string) => {
    return Promise.resolve(
      recipeId === 'recipe-123' ? [mockStep, mockStep2, mockStep3] : [mockStep],
    );
  });

  mockRepo.findStepById.mockImplementation((stepId: string) => {
    if (stepId === 'step-123') return Promise.resolve(mockStep);
    if (stepId === 'step-2') return Promise.resolve(mockStep2);
    if (stepId === 'step-3') return Promise.resolve(mockStep3);
    return Promise.resolve(null);
  });

  mockRepo.createStep.mockImplementation((data: any) => {
    return Promise.resolve({ id: crypto.randomUUID(), ...data });
  });

  mockRepo.updateStep.mockImplementation((id: string, data: any) => {
    return Promise.resolve({ id, ...data });
  });

  mockRepo.deleteStep.mockResolvedValue(undefined);

  return mockRepo;
};

// Mock AtomRepository
const createMockAtomRepository = (): jest.Mocked<AtomRepository> => {
  const mockRepo: jest.Mocked<AtomRepository> = {
    findById: jest.fn(),
    findByCanonicalId: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findOptionsByAtomId: jest.fn(),
    createOption: jest.fn(),
    findCompetenciesByAtomId: jest.fn(),
    linkCompetency: jest.fn(),
  };

  mockRepo.create.mockImplementation((data: any) => {
    return Promise.resolve({ id: crypto.randomUUID(), ...data });
  });
  mockRepo.update.mockImplementation((id: string, data: any) => {
    return Promise.resolve({ id, ...data });
  });

  return mockRepo;
};

describe('RecipeService', () => {
  let recipeRepository: jest.Mocked<RecipeRepository>;
  let atomRepository: jest.Mocked<AtomRepository>;
  let service: RecipeService;

  beforeEach(() => {
    recipeRepository = createMockRecipeRepository();
    atomRepository = createMockAtomRepository();
    service = new RecipeService(recipeRepository, atomRepository);
  });

  // Tests for createRecipe, getRecipeById, updateRecipe, deleteRecipe ...
  // ... and for addStep, updateStep, deleteStep, reorderSteps
  describe('createRecipe', () => {
    it('should create a recipe with generated canonicalId and version 1.0.0', async () => {
      const input = {
        title: 'New Recipe',
        description: 'A new recipe description',
        expectedDurationMinutes: 45,
        published: false,
      };

      // Mock the addStep call within createRecipe
      const addStepSpy = jest.spyOn(service, 'addStep' as any); // Spy on private method
      addStepSpy.mockResolvedValue(mockStep);

      recipeRepository.create.mockResolvedValue(
        createMockRecipe({
          id: 'new-recipe-id',
          title: input.title,
          canonicalId: 'my-new-recipe',
          version: '1.0.0',
        }),
      );
      recipeRepository.findByIdWithSteps.mockResolvedValue(
        createMockRecipe({
          id: 'new-recipe-id',
          title: input.title,
          canonicalId: 'my-new-recipe',
          version: '1.0.0',
        }),
      );

      const result = await service.createRecipe(input, 'user-123');

      expect(recipeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Recipe',
          canonicalId: expect.any(String), // Canonical ID is generated
          version: '1.0.0',
        }),
      );
      expect(result.title).toBe('New Recipe');
      expect(result.version).toBe('1.0.0');
      addStepSpy.mockRestore(); // Clean up the spy
    });

    it('should throw RecipeValidationError if title is empty', async () => {
      const input = {
        title: '',
      };

      await expect(service.createRecipe(input, 'user-123')).rejects.toThrow(RecipeValidationError);
    });

    it('should call addStep for each step provided in input', async () => {
      const recipeInput = {
        title: 'Recipe with Steps',
        steps: [
          {
            stepType: 'content' as const,
            script: {
              transition: { text: 't' },
              content: { text: 'c', chunks: [{ text: 'ch', pauseAfter: 0 }] },
              examples: [],
              closure: { text: 'cl' },
            },
          },
        ],
      };
      const createdRecipe = createMockRecipe({ id: 'recipe-with-steps' });
      recipeRepository.create.mockResolvedValue(createdRecipe);

      // Mock addStep to return a resolved promise with a mock step
      const addStepSpy = jest.spyOn(service, 'addStep' as any); // Spy on private method
      addStepSpy.mockResolvedValue(mockStep);

      await service.createRecipe(recipeInput, 'user-123');

      expect(service.addStep).toHaveBeenCalledTimes(1);
      expect(service.addStep).toHaveBeenCalledWith(
        createdRecipe.id,
        expect.objectContaining({
          stepType: 'content',
        }),
        'user-123',
      );
      addStepSpy.mockRestore();
    });
  });

  describe('getRecipeById', () => {
    it('should return a recipe by ID with steps', async () => {
      recipeRepository.findByIdWithSteps.mockResolvedValue(
        createMockRecipe({ id: 'recipe-123', steps: [mockStep] }),
      );

      const result = await service.getRecipeById('recipe-123');

      expect(result).toEqual(expect.objectContaining({ id: 'recipe-123', steps: [mockStep] }));
    });

    it('should throw RecipeNotFoundError if recipe not found', async () => {
      recipeRepository.findByIdWithSteps.mockResolvedValue(null);

      await expect(service.getRecipeById('nonexistent')).rejects.toThrow(RecipeNotFoundError);
    });
  });

  describe('updateRecipe', () => {
    it('should update recipe details and increment version', async () => {
      const existingRecipe = createMockRecipe({
        id: 'recipe-123',
        title: 'Old Title',
        version: '1.0.0',
      });
      recipeRepository.findById.mockResolvedValue(existingRecipe);
      recipeRepository.update.mockResolvedValue(
        createMockRecipe({ ...existingRecipe, title: 'New Title', version: '1.0.1' }),
      );
      recipeRepository.findByIdWithSteps.mockResolvedValue(
        createMockRecipe({ ...existingRecipe, title: 'New Title', version: '1.0.1' }),
      ); // For getRecipeById call at the end

      const updateInput = { title: 'New Title' };
      const result = await service.updateRecipe('recipe-123', updateInput, 'user-123');

      expect(recipeRepository.update).toHaveBeenCalledWith('recipe-123', {
        title: 'New Title',
        canonicalId: expect.any(String), // Recalculated
        version: '1.0.1',
      });
      expect(result.title).toBe('New Title');
      expect(result.version).toBe('1.0.1');
    });

    it('should throw RecipeNotFoundError if recipe not found', async () => {
      recipeRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateRecipe('nonexistent', { title: 'New' }, 'user-123'),
      ).rejects.toThrow(RecipeNotFoundError);
    });
  });

  describe('deleteRecipe', () => {
    it('should soft delete recipe by setting published to false', async () => {
      recipeRepository.findById.mockResolvedValue(createMockRecipe());
      recipeRepository.update.mockResolvedValue(createMockRecipe({ published: false }));

      await service.deleteRecipe('recipe-123', 'user-123', false);

      expect(recipeRepository.update).toHaveBeenCalledWith('recipe-123', { published: false });
    });

    it('should throw RecipeNotFoundError if recipe not found', async () => {
      recipeRepository.findById.mockResolvedValue(null);

      await expect(service.deleteRecipe('nonexistent', 'user-123', false)).rejects.toThrow(
        RecipeNotFoundError,
      );
    });
  });

  describe('addStep', () => {
    it('should add a step to recipe and generate atomId', async () => {
      const stepInput: CreateRecipeStepInput = {
        order: 0,
        stepType: 'content',
        script: {
          transition: { text: 'Intro' },
          content: { text: 'Content', chunks: [{ text: 'c', pauseAfter: 0 }] },
          examples: [],
          closure: { text: 'cl' },
        },
      };
      recipeRepository.findById.mockResolvedValue(createMockRecipe());
      recipeRepository.findStepsByRecipeId.mockResolvedValue([]);
      recipeRepository.createStep.mockImplementation((data) =>
        Promise.resolve({ ...data, createdAt: new Date() }),
      );
      atomRepository.create.mockImplementation((data) =>
        Promise.resolve({ ...data, createdAt: new Date(), updatedAt: new Date() }),
      );

      const result = await service.addStep('recipe-123', stepInput, 'user-123');

      expect(atomRepository.create).toHaveBeenCalled();
      expect(recipeRepository.createStep).toHaveBeenCalledWith(
        expect.objectContaining({
          atomId: expect.any(String), // Atom ID should be generated
          order: 0,
          stepType: 'content',
          script: expect.objectContaining({
            content: expect.objectContaining({ text: 'Content' }),
          }),
        }),
      );
      expect(result).toBeDefined();
      expect(result.atomId).toBeDefined();
    });

    it('should throw RecipeNotFoundError if recipe not found', async () => {
      recipeRepository.findById.mockResolvedValue(null);

      const stepInput: CreateRecipeStepInput = {
        stepType: 'content',
        script: {
          transition: { text: 't' },
          content: { text: 'c', chunks: [{ text: 'ch', pauseAfter: 0 }] },
          examples: [],
          closure: { text: 'cl' },
        },
      };

      await expect(service.addStep('nonexistent', stepInput, 'user-123')).rejects.toThrow(
        RecipeNotFoundError,
      );
    });
  });

  describe('updateStep', () => {
    it('should update a step and update its associated Atom', async () => {
      recipeRepository.findStepById.mockResolvedValue(mockStep);
      recipeRepository.findById.mockResolvedValue(createMockRecipe());
      recipeRepository.updateStep.mockResolvedValue({ ...mockStep, order: 5 });
      atomRepository.update.mockResolvedValue({
        id: 'atom-123',
        canonicalId: 'test-atom',
        title: 'Test Atom',
        type: 'MICROLECTURE' as any,
        locale: 'en',
        difficulty: 1,
        version: '1.0.0',
        published: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const stepInput = {
        order: 5,
        script: {
          transition: { text: 'New T' },
          content: { text: 'New C', chunks: [{ text: 'ch', pauseAfter: 0 }] },
          examples: [],
          closure: { text: 'cl' },
        },
      };

      const result = await service.updateStep('step-123', stepInput, 'user-123');

      expect(atomRepository.update).toHaveBeenCalledWith(
        mockStep.atomId,
        expect.objectContaining({
          content: expect.objectContaining({
            type: 'content',
            script: expect.objectContaining({
              content: expect.objectContaining({ text: 'New C' }),
            }),
          }),
        }),
      );
      expect(recipeRepository.updateStep).toHaveBeenCalledWith(
        'step-123',
        expect.objectContaining({
          order: 5,
          script: expect.objectContaining({
            content: expect.objectContaining({ text: 'New C' }),
          }),
        }),
      );
      expect(result).toBeDefined();
      expect(result.order).toBe(5);
    });

    it('should throw StepNotFoundError if step not found', async () => {
      recipeRepository.findStepById.mockResolvedValue(null);

      await expect(service.updateStep('nonexistent', { order: 1 }, 'user-123')).rejects.toThrow(
        StepNotFoundError,
      );
    });

    it('should throw RecipeNotFoundError if parent recipe not found (should not happen)', async () => {
      recipeRepository.findStepById.mockResolvedValue(mockStep);
      recipeRepository.findById.mockResolvedValue(null);

      await expect(service.updateStep('step-123', { order: 1 }, 'user-123')).rejects.toThrow(
        RecipeNotFoundError,
      );
    });
  });

  describe('deleteStep', () => {
    it('should delete a step', async () => {
      recipeRepository.findStepById.mockResolvedValue(mockStep);
      recipeRepository.findById.mockResolvedValue(createMockRecipe());

      await service.deleteStep('step-123', 'user-123');

      expect(recipeRepository.deleteStep).toHaveBeenCalledWith('step-123');
    });

    it('should throw StepNotFoundError if step not found', async () => {
      recipeRepository.findStepById.mockResolvedValue(null);

      await expect(service.deleteStep('nonexistent', 'user-123')).rejects.toThrow(
        StepNotFoundError,
      );
    });
  });

  describe('reorderSteps', () => {
    it('should reorder steps within a recipe', async () => {
      // Use step IDs that exist in our mock: step-123, step-2, step-3
      const stepIds = [mockStep2.id, mockStep.id, mockStep3.id]; // Use actual mock IDs

      await service.reorderSteps('recipe-123', stepIds, 'user-123');

      // Two updates per step: temporary negative, then final order
      expect(recipeRepository.updateStep).toHaveBeenCalledTimes(6);

      // Verify temporary negative ordering
      expect(recipeRepository.updateStep).toHaveBeenCalledWith(mockStep2.id, { order: -1 });
      expect(recipeRepository.updateStep).toHaveBeenCalledWith(mockStep.id, { order: -2 });
      expect(recipeRepository.updateStep).toHaveBeenCalledWith(mockStep3.id, { order: -3 });

      // Verify final ordering
      expect(recipeRepository.updateStep).toHaveBeenCalledWith(mockStep2.id, { order: 0 });
      expect(recipeRepository.updateStep).toHaveBeenCalledWith(mockStep.id, { order: 1 });
      expect(recipeRepository.updateStep).toHaveBeenCalledWith(mockStep3.id, { order: 2 });
    });

    it('should throw RecipeNotFoundError if recipe not found', async () => {
      recipeRepository.findById.mockResolvedValue(null);

      await expect(service.reorderSteps('nonexistent', ['step-123'], 'user-123')).rejects.toThrow(
        RecipeNotFoundError,
      );
    });

    it('should throw StepNotFoundError if step does not belong to recipe', async () => {
      recipeRepository.findById.mockResolvedValue(createMockRecipe());
      recipeRepository.findStepsByRecipeId.mockResolvedValue([mockStep]); // Only mockStep exists

      await expect(
        service.reorderSteps('recipe-123', ['nonexistent-step'], 'user-123'),
      ).rejects.toThrow('Step with ID nonexistent-step not found');
    });
  });

  describe('listRecipes', () => {
    it('should return all recipes by default', async () => {
      recipeRepository.findAll.mockResolvedValue([createMockRecipe()]);

      const result = await service.listRecipes();

      expect(recipeRepository.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should filter by published status', async () => {
      recipeRepository.findPublished.mockResolvedValue([createMockRecipe({ published: true })]);

      const result = await service.listRecipes({ published: true });

      expect(recipeRepository.findPublished).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should return all recipes when option is false', async () => {
      recipeRepository.findAll.mockResolvedValue([createMockRecipe()]);

      const result = await service.listRecipes({ published: false });

      expect(recipeRepository.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
