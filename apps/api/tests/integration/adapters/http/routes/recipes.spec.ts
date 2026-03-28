/**
 * Integration Tests for Recipe API Routes
 *
 * Tests cover all CRUD and steps management endpoints.
 */

import request from 'supertest';

import { createRecipesRouter } from '@/infrastructure/adapters/http/routes/recipes.js';
import type { RecipeService } from '@/application/services/recipe.service.js';
import {
  RecipeNotFoundError,
  RecipeOwnershipError,
  RecipeValidationError,
  StepNotFoundError,
} from '@/application/services/recipe.service.js';
import type { Recipe, RecipeStep } from '@/domain/entities/recipe.js';

// Valid UUIDs for tests
const RECIPE_ID = '123e4567-e89b-12d3-a456-426614174000';
const STEP_ID_1 = '223e4567-e89b-12d3-a456-426614174000';
const STEP_ID_2 = '323e4567-e89b-12d3-a456-426614174000';
const ATOM_ID = '423e4567-e89b-12d3-a456-426614174000';
const USER_ID = '523e4567-e89b-12d3-a456-426614174000';

// Mock factories
const createMockRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: RECIPE_ID,
  canonicalId: 'test-recipe',
  title: 'Test Recipe',
  description: 'Test Description',
  expectedDurationMinutes: 30,
  version: '1.0.0',
  published: false,
  moduleId: undefined,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  steps: [],
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

// Mock RecipeService
const createMockRecipeService = (): jest.Mocked<RecipeService> => {
  const mockService = {
    createRecipe: jest.fn(),
    getRecipeById: jest.fn(),
    updateRecipe: jest.fn(),
    deleteRecipe: jest.fn(),
    addStep: jest.fn(),
    updateStep: jest.fn(),
    deleteStep: jest.fn(),
    reorderSteps: jest.fn(),
    listRecipes: jest.fn(),
  } as unknown as jest.Mocked<RecipeService>;
  return mockService;
};

// Mock use cases
const createMockGetRecipeUseCase = () => ({
  execute: jest.fn(),
});

const createMockListRecipesUseCase = () => ({
  execute: jest.fn(),
});

// Helper to create app with mocked auth
const createApp = (
  recipeService: jest.Mocked<RecipeService>,
  getRecipeUseCase = createMockGetRecipeUseCase(),
  listRecipesUseCase = createMockListRecipesUseCase(),
  user: { id: string; role: string } = { id: USER_ID, role: 'TEACHER' },
) => {
  const router = createRecipesRouter({
    recipeService,
    getRecipeUseCase: getRecipeUseCase as any,
    listRecipesUseCase: listRecipesUseCase as any,
  });

  const express = require('express');
  const app = express();
  app.use(express.json());

  // Mock auth middleware
  app.use((req: any, _res: any, next: any) => {
    req.user = user;
    next();
  });

  app.use('/api/recipes', router);
  return app;
};

describe('Recipes API Routes', () => {
  let recipeService: jest.Mocked<RecipeService>;
  let getRecipeUseCase: any;
  let listRecipesUseCase: any;

  beforeEach(() => {
    recipeService = createMockRecipeService();
    getRecipeUseCase = createMockGetRecipeUseCase();
    listRecipesUseCase = createMockListRecipesUseCase();
  });

  describe('POST /api/recipes', () => {
    it('should create a new recipe and return 201', async () => {
      const mockRecipe = createMockRecipe({ id: 'new-recipe-id', title: 'New Recipe' });
      recipeService.createRecipe.mockResolvedValue(mockRecipe);

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app).post('/api/recipes').send({
        title: 'New Recipe',
        description: 'Description',
        expectedDurationMinutes: 45,
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 'new-recipe-id');
      expect(response.body.title).toBe('New Recipe');
    });

    it('should return 400 for validation error', async () => {
      recipeService.createRecipe.mockRejectedValue(
        new RecipeValidationError('Recipe title is required'),
      );

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app).post('/api/recipes').send({});

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('RECIPE_VALIDATION_ERROR');
    });

    it('should return 401 when user not authenticated', async () => {
      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase, {
        id: '',
        role: '',
      } as any);

      const response = await request(app).post('/api/recipes').send({ title: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/recipes', () => {
    it('should list recipes', async () => {
      const mockRecipes = [
        createMockRecipe({ id: 'recipe-1' }),
        createMockRecipe({ id: 'recipe-2' }),
      ];
      listRecipesUseCase.execute.mockResolvedValue(mockRecipes);

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app).get('/api/recipes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/recipes/:id', () => {
    it('should return recipe with steps', async () => {
      const mockRecipe = createMockRecipe({
        id: RECIPE_ID,
        steps: [createMockStep({ id: STEP_ID_1 })],
      });
      recipeService.getRecipeById.mockResolvedValue(mockRecipe as any);

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app).get(`/api/recipes/${RECIPE_ID}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(RECIPE_ID);
      expect(response.body.steps).toHaveLength(1);
    });

    it('should return 404 when recipe not found', async () => {
      recipeService.getRecipeById.mockRejectedValue(new RecipeNotFoundError(RECIPE_ID));

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app).get(`/api/recipes/${RECIPE_ID}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/recipes/:id', () => {
    it('should update recipe and return 200', async () => {
      const updatedRecipe = createMockRecipe({
        id: RECIPE_ID,
        title: 'Updated Title',
        version: '1.0.1',
      });
      recipeService.updateRecipe.mockResolvedValue(updatedRecipe);

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
    });

    it('should return 404 when recipe not found', async () => {
      recipeService.updateRecipe.mockRejectedValue(new RecipeNotFoundError(RECIPE_ID));

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
    });

    it('should return 403 when user does not own recipe', async () => {
      recipeService.updateRecipe.mockRejectedValue(new RecipeOwnershipError(RECIPE_ID, USER_ID));

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/recipes/:id', () => {
    it('should delete recipe and return 204', async () => {
      recipeService.deleteRecipe.mockResolvedValue(undefined);

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app).delete(`/api/recipes/${RECIPE_ID}`);

      expect(response.status).toBe(204);
    });

    it('should return 404 when recipe not found', async () => {
      recipeService.deleteRecipe.mockRejectedValue(new RecipeNotFoundError(RECIPE_ID));

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app).delete(`/api/recipes/${RECIPE_ID}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/recipes/:id/steps', () => {
    it('should add step and return 201', async () => {
      const newStep = createMockStep({ id: 'new-step-id', order: 0 });
      recipeService.addStep.mockResolvedValue(newStep);

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .post(`/api/recipes/${RECIPE_ID}/steps`)
        .send({
          atomId: ATOM_ID,
          order: 0,
          stepType: 'content',
          script: {
            transition: { text: 'Start' },
            content: { text: 'Content text', chunks: [{ text: 'Chunk', pauseAfter: 0 }] },
            examples: [{ text: 'Example', visual: { type: 'image' } }],
            closure: { text: 'End' },
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('new-step-id');
    });

    it('should return 404 when recipe not found', async () => {
      recipeService.addStep.mockRejectedValue(new RecipeNotFoundError(RECIPE_ID));

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .post(`/api/recipes/${RECIPE_ID}/steps`)
        .send({
          atomId: ATOM_ID,
          stepType: 'content',
          script: {
            transition: { text: 'Start' },
            content: { text: 'Content', chunks: [{ text: 'Chunk', pauseAfter: 0 }] },
            examples: [{ text: 'Example', visual: { type: 'image' } }],
            closure: { text: 'End' },
          },
        });

      expect(response.status).toBe(404);
    });

    it('should return 400 for validation error', async () => {
      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .post(`/api/recipes/${RECIPE_ID}/steps`)
        .send({ atomId: ATOM_ID }); // Missing stepType and script

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/recipes/:id/steps/:stepId', () => {
    it('should update step and return 200', async () => {
      const updatedStep = createMockStep({ id: STEP_ID_1, order: 5 });
      recipeService.updateStep.mockResolvedValue(updatedStep);

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}/steps/${STEP_ID_1}`)
        .send({ order: 5 });

      expect(response.status).toBe(200);
    });

    it('should return 404 when step not found', async () => {
      recipeService.updateStep.mockRejectedValue(new StepNotFoundError(STEP_ID_1));

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}/steps/${STEP_ID_1}`)
        .send({ order: 5 });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/recipes/:id/steps/:stepId', () => {
    it('should delete step and return 204', async () => {
      recipeService.deleteStep.mockResolvedValue(undefined);

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app).delete(`/api/recipes/${RECIPE_ID}/steps/${STEP_ID_1}`);

      expect(response.status).toBe(204);
    });

    it('should return 404 when step not found', async () => {
      recipeService.deleteStep.mockRejectedValue(new StepNotFoundError(STEP_ID_1));

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app).delete(`/api/recipes/${RECIPE_ID}/steps/${STEP_ID_1}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/recipes/:id/steps/reorder', () => {
    it('should reorder steps and return 204', async () => {
      recipeService.reorderSteps.mockResolvedValue(undefined);

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}/steps/reorder`)
        .send({
          stepIds: [STEP_ID_2, STEP_ID_1],
        });

      expect(response.status).toBe(204);
    });

    it('should return 404 when recipe not found', async () => {
      recipeService.reorderSteps.mockRejectedValue(new RecipeNotFoundError(RECIPE_ID));

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .patch('/api/recipes/non-existent/steps/reorder')
        .send({
          stepIds: [STEP_ID_1],
        });

      expect(response.status).toBe(404);
    });

    it('should return 404 when step not found', async () => {
      recipeService.reorderSteps.mockRejectedValue(new StepNotFoundError('non-existent'));

      const app = createApp(recipeService, getRecipeUseCase, listRecipesUseCase);

      const response = await request(app)
        .patch(`/api/recipes/${RECIPE_ID}/steps/reorder`)
        .send({
          stepIds: ['999e4567-e89b-12d3-a456-426614174000'], // non-existent step ID
        });

      expect(response.status).toBe(404);
    });
  });
});
