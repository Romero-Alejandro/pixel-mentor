/**
 * Integration Tests for Recipe API Routes
 *
 * Tests cover all CRUD and steps management endpoints.
 */

import request from 'supertest';

import { createRecipesRouter } from '@/features/recipe/infrastructure/http/recipes.routes.js';
import {
  RecipeNotFoundError,
  RecipeOwnershipError,
  StepNotFoundError,
} from '@/shared/errors/domain-errors.js';
import type { Recipe, RecipeStep } from '@/features/recipe/domain/entities/recipe.entity.js';
import { CanonicalId } from '@/features/recipe/domain/valueObjects/canonical-id.vo.js';
import { SemanticVersion } from '@/features/recipe/domain/valueObjects/semantic-version.vo.js';
import { ExpectedDuration } from '@/features/recipe/domain/valueObjects/expected-duration.vo.js';

// Valid UUIDs for tests
const RECIPE_ID = '123e4567-e89b-12d3-a456-426614174000';
const STEP_ID_1 = '223e4567-e89b-12d3-a456-426614174000';
const STEP_ID_2 = '323e4567-e89b-12d3-a456-426614174000';
const ATOM_ID = '423e4567-e89b-12d3-a456-426614174000';
const USER_ID = '523e4567-e89b-12d3-a456-426614174000';

// Mock factories
const createMockRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: RECIPE_ID,
  canonicalId: CanonicalId.create('test-recipe'),
  title: 'Test Recipe',
  description: 'Test Description',
  expectedDurationMinutes: ExpectedDuration.create(30),
  version: SemanticVersion.parse('1.0.0'),
  published: false,
  moduleId: undefined,
  authorId: USER_ID,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  steps: [],
  concepts: [],
  tags: [],
  attachments: [],
  progressEntries: [],
  ...overrides,
});

const createMockStep = (overrides: Partial<RecipeStep> = {}): RecipeStep => ({
  id: STEP_ID_1,
  recipeId: RECIPE_ID,
  atomId: ATOM_ID,
  order: 0,
  condition: undefined,
  onCondition: undefined,
  createdAt: new Date('2024-01-01'),
  stepType: 'content',
  conceptId: undefined,
  activityId: undefined,
  script: {
    transition: { text: 'Intro' },
    content: { text: 'Content', chunks: [{ text: 'Chunk', pauseAfter: 0 }] },
    examples: [{ text: 'Example', visual: { type: 'image' as const } }],
    closure: { text: 'Outro' },
  },
  ...overrides,
});

// Mock use cases
const createMockCreateRecipeUseCase = () => ({
  execute: jest.fn(),
});

const createMockUpdateRecipeUseCase = () => ({
  execute: jest.fn(),
});

const createMockDeleteRecipeUseCase = () => ({
  execute: jest.fn(),
});

const createMockAddStepUseCase = () => ({
  execute: jest.fn(),
});

const createMockUpdateStepUseCase = () => ({
  execute: jest.fn(),
});

const createMockDeleteStepUseCase = () => ({
  execute: jest.fn(),
});

const createMockReorderStepsUseCase = () => ({
  execute: jest.fn(),
});

const createMockGetRecipeUseCase = () => ({
  execute: jest.fn(),
});

const createMockListRecipesUseCase = () => ({
  execute: jest.fn(),
});

// Helper to create app with mocked auth
const createApp = (
  createRecipeUseCase = createMockCreateRecipeUseCase(),
  getRecipeUseCase = createMockGetRecipeUseCase(),
  listRecipesUseCase = createMockListRecipesUseCase(),
  updateRecipeUseCase = createMockUpdateRecipeUseCase(),
  deleteRecipeUseCase = createMockDeleteRecipeUseCase(),
  addStepUseCase = createMockAddStepUseCase(),
  updateStepUseCase = createMockUpdateStepUseCase(),
  deleteStepUseCase = createMockDeleteStepUseCase(),
  reorderStepsUseCase = createMockReorderStepsUseCase(),
  user: { id: string; role: string } = { id: USER_ID, role: 'TEACHER' },
) => {
  const router = createRecipesRouter({
    createRecipeUseCase: createRecipeUseCase as any,
    getRecipeUseCase: getRecipeUseCase as any,
    listRecipesUseCase: listRecipesUseCase as any,
    updateRecipeUseCase: updateRecipeUseCase as any,
    deleteRecipeUseCase: deleteRecipeUseCase as any,
    addStepUseCase: addStepUseCase as any,
    updateStepUseCase: updateStepUseCase as any,
    deleteStepUseCase: deleteStepUseCase as any,
    reorderStepsUseCase: reorderStepsUseCase as any,
  });

  const express = require('express');
  const app = express();
  app.use(express.json());

  // Mock auth middleware
  app.use((req: any, _res: any, next: any) => {
    req.user = user;
    req.logger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
    next();
  });

  app.use('/api/recipes', router);
  return app;
};

describe('Recipes API Routes', () => {
  let createRecipeUseCase: any;
  let getRecipeUseCase: any;
  let listRecipesUseCase: any;
  let updateRecipeUseCase: any;
  let deleteRecipeUseCase: any;
  let addStepUseCase: any;
  let updateStepUseCase: any;
  let deleteStepUseCase: any;
  let reorderStepsUseCase: any;

  beforeEach(() => {
    createRecipeUseCase = createMockCreateRecipeUseCase();
    getRecipeUseCase = createMockGetRecipeUseCase();
    listRecipesUseCase = createMockListRecipesUseCase();
    updateRecipeUseCase = createMockUpdateRecipeUseCase();
    deleteRecipeUseCase = createMockDeleteRecipeUseCase();
    addStepUseCase = createMockAddStepUseCase();
    updateStepUseCase = createMockUpdateStepUseCase();
    deleteStepUseCase = createMockDeleteStepUseCase();
    reorderStepsUseCase = createMockReorderStepsUseCase();
  });

  describe('POST /', () => {
    it('should create a new recipe', async () => {
      const mockRecipe = createMockRecipe();
      createRecipeUseCase.execute.mockResolvedValue(mockRecipe);

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app).post('/api/recipes').send({ title: 'New Recipe' });

      expect(response.status).toBe(201);
      expect(createRecipeUseCase.execute).toHaveBeenCalled();
    });

    it('should return 400 for empty title', async () => {
      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app).post('/api/recipes').send({ title: '' });

      expect(response.status).toBe(400);
    });

    it('should return 401 if not authenticated', async () => {
      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
        { id: '', role: 'TEACHER' },
      );

      const response = await request(app).post('/api/recipes').send({ title: 'Test Recipe' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /:id', () => {
    it('should return a recipe by ID', async () => {
      const mockRecipe = createMockRecipe();
      getRecipeUseCase.execute.mockResolvedValue(mockRecipe);

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app).get(`/api/recipes/${RECIPE_ID}`);

      expect(response.status).toBe(200);
      expect(getRecipeUseCase.execute).toHaveBeenCalledWith(RECIPE_ID);
    });

    it('should return 404 for non-existent recipe', async () => {
      getRecipeUseCase.execute.mockRejectedValue(new RecipeNotFoundError(RECIPE_ID));

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app).get(`/api/recipes/${RECIPE_ID}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /:id', () => {
    it('should update a recipe', async () => {
      const updatedRecipe = createMockRecipe({ title: 'Updated Recipe' });
      updateRecipeUseCase.execute.mockResolvedValue(updatedRecipe);

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}`)
        .send({ title: 'Updated Recipe' });

      expect(response.status).toBe(200);
      expect(updateRecipeUseCase.execute).toHaveBeenCalled();
    });

    it('should return 404 for non-existent recipe', async () => {
      updateRecipeUseCase.execute.mockRejectedValue(new RecipeNotFoundError(RECIPE_ID));

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}`)
        .send({ title: 'Updated Recipe' });

      expect(response.status).toBe(404);
    });

    it('should return 403 when user does not own recipe', async () => {
      updateRecipeUseCase.execute.mockRejectedValue(new RecipeOwnershipError(RECIPE_ID, USER_ID));

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}`)
        .send({ title: 'Updated Recipe' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /:id', () => {
    it('should delete a recipe', async () => {
      deleteRecipeUseCase.execute.mockResolvedValue(undefined);

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app).delete(`/api/recipes/${RECIPE_ID}`);

      expect(response.status).toBe(204);
      expect(deleteRecipeUseCase.execute).toHaveBeenCalledWith(RECIPE_ID, USER_ID);
    });

    it('should return 404 for non-existent recipe', async () => {
      deleteRecipeUseCase.execute.mockRejectedValue(new RecipeNotFoundError(RECIPE_ID));

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app).delete(`/api/recipes/${RECIPE_ID}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /:id/steps', () => {
    it('should add a step to a recipe', async () => {
      const newStep = createMockStep();
      addStepUseCase.execute.mockResolvedValue(newStep);

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app)
        .post(`/api/recipes/${RECIPE_ID}/steps`)
        .send({ stepType: 'content' });

      expect(response.status).toBe(201);
      expect(addStepUseCase.execute).toHaveBeenCalled();
    });

    it('should return 404 when recipe not found', async () => {
      addStepUseCase.execute.mockRejectedValue(new RecipeNotFoundError(RECIPE_ID));

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app)
        .post(`/api/recipes/${RECIPE_ID}/steps`)
        .send({ stepType: 'content' });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /:id/steps/:stepId', () => {
    it('should update a step', async () => {
      const updatedStep = createMockStep({ order: 1 });
      updateStepUseCase.execute.mockResolvedValue(updatedStep);

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}/steps/${STEP_ID_1}`)
        .send({ order: 1 });

      expect(response.status).toBe(200);
      expect(updateStepUseCase.execute).toHaveBeenCalled();
    });

    it('should return 404 when step not found', async () => {
      updateStepUseCase.execute.mockRejectedValue(new StepNotFoundError(STEP_ID_1));

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}/steps/${STEP_ID_1}`)
        .send({ order: 1 });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /:id/steps/:stepId', () => {
    it('should delete a step', async () => {
      deleteStepUseCase.execute.mockResolvedValue(undefined);

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app).delete(`/api/recipes/${RECIPE_ID}/steps/${STEP_ID_1}`);

      expect(response.status).toBe(204);
      expect(deleteStepUseCase.execute).toHaveBeenCalledWith(STEP_ID_1, USER_ID);
    });

    it('should return 404 when step not found', async () => {
      deleteStepUseCase.execute.mockRejectedValue(new StepNotFoundError(STEP_ID_1));

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app).delete(`/api/recipes/${RECIPE_ID}/steps/${STEP_ID_1}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /:id/steps/reorder', () => {
    it('should reorder steps', async () => {
      reorderStepsUseCase.execute.mockResolvedValue(undefined);

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}/steps/reorder`)
        .send({ stepIds: [STEP_ID_2, STEP_ID_1] });

      expect(response.status).toBe(204);
      expect(reorderStepsUseCase.execute).toHaveBeenCalledWith(
        RECIPE_ID,
        [STEP_ID_2, STEP_ID_1],
        USER_ID,
      );
    });

    it('should return 404 when recipe not found', async () => {
      reorderStepsUseCase.execute.mockRejectedValue(new RecipeNotFoundError(RECIPE_ID));

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}/steps/reorder`)
        .send({ stepIds: [STEP_ID_2, STEP_ID_1] });

      expect(response.status).toBe(404);
    });

    it('should return 404 when step not found', async () => {
      reorderStepsUseCase.execute.mockRejectedValue(new StepNotFoundError('non-existent'));

      const app = createApp(
        createRecipeUseCase,
        getRecipeUseCase,
        listRecipesUseCase,
        updateRecipeUseCase,
        deleteRecipeUseCase,
        addStepUseCase,
        updateStepUseCase,
        deleteStepUseCase,
        reorderStepsUseCase,
      );

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}/steps/reorder`)
        .send({ stepIds: ['non-existent'] });

      expect(response.status).toBe(404);
    });
  });
});
