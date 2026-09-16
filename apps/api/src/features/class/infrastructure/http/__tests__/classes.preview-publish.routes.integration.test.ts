/**
 * Integration Tests: Tutor Preview Flow and Publish-with-Age Endpoint
 *
 * Covers:
 * - POST /api/classes/:id/preview  (tutor preview: ownership, DRAFT-only,
 *   lesson-with-recipe requirement, orchestration payload, error mapping)
 * - POST /api/classes/:id/publish  (age range validation, age persistence
 *   through updateClass + publishClass, existing behaviors)
 */

import request from 'supertest';

import { createClassRouter } from '@/features/class/infrastructure/http/classes.routes.js';
import { errorHandler } from '@/shared/http/error-handler.middleware.js';
import {
  ClassNotFoundError,
  ClassOwnershipError,
  ClassStateError,
  ClassValidationError,
} from '@/features/class/application/services/class.service.js';
import type {
  ClassEntity,
  ClassLessonEntity,
} from '@/features/class/domain/entities/class.entity.js';

// ==================== Mock Factories ====================

const createMockClass = (overrides: Partial<ClassEntity> = {}): ClassEntity => ({
  id: 'class-1',
  title: 'Fracciones divertidas',
  description: 'Aprende fracciones jugando',
  tutorId: 'tutor-1',
  status: 'DRAFT',
  version: 0,
  targetAgeMin: 6,
  targetAgeMax: 8,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lessons: [],
  ...overrides,
});

const createMockLesson = (overrides: Partial<ClassLessonEntity> = {}): ClassLessonEntity => ({
  id: 'lesson-1',
  classId: 'class-1',
  order: 0,
  recipeId: 'recipe-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  recipe: {
    id: 'recipe-1',
    title: 'Mitades y cuartos',
    expectedDurationMinutes: 12,
    steps: [{ id: 'step-1', order: 0, script: { text: 'Hola exploradores' } }],
  },
  ...overrides,
});

interface MockDeps {
  classService: {
    createClass: jest.Mock;
    getClass: jest.Mock;
    updateClass: jest.Mock;
    deleteClass: jest.Mock;
    listClasses: jest.Mock;
    publishClass: jest.Mock;
    unpublishClass: jest.Mock;
    addLesson: jest.Mock;
    removeLesson: jest.Mock;
    reorderLessons: jest.Mock;
    updateLesson: jest.Mock;
    getLesson: jest.Mock;
  };
  classLessonRepository: { findByClassId: jest.Mock; findClassIdByLessonId: jest.Mock };
  startRecipeUseCase: { execute: jest.Mock };
  orchestrateUseCase: { interact: jest.Mock };
  contentAccessService: { canAccessClass: jest.Mock };
}

const createMockDeps = (): MockDeps => ({
  classService: {
    createClass: jest.fn(),
    getClass: jest.fn(),
    updateClass: jest.fn(),
    deleteClass: jest.fn(),
    listClasses: jest.fn(),
    publishClass: jest.fn(),
    unpublishClass: jest.fn(),
    addLesson: jest.fn(),
    removeLesson: jest.fn(),
    reorderLessons: jest.fn(),
    updateLesson: jest.fn(),
    getLesson: jest.fn(),
  },
  classLessonRepository: {
    findByClassId: jest.fn(),
    findClassIdByLessonId: jest.fn(),
  },
  startRecipeUseCase: { execute: jest.fn() },
  orchestrateUseCase: { interact: jest.fn() },
  contentAccessService: { canAccessClass: jest.fn() },
});

type TestUser = { id: string; role: string } | null;

const createApp = (deps: MockDeps, user: TestUser = { id: 'tutor-1', role: 'TEACHER' }) => {
  const express = require('express');
  const app = express();
  app.use(express.json());

  app.use((req: Record<string, unknown>, _res: unknown, next: () => void) => {
    if (user) {
      req.user = user;
    }
    next();
  });

  app.use(
    '/api/classes',
    createClassRouter(deps as unknown as Parameters<typeof createClassRouter>[0]),
  );
  app.use(errorHandler);
  return app;
};

// ==================== Preview Flow ====================

describe('POST /api/classes/:id/preview', () => {
  let deps: MockDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  it('should start a preview session on the first lesson with a recipe and return the interaction payload', async () => {
    // Given: an owned DRAFT class whose first lesson has a recipe
    const mockClass = createMockClass({
      lessons: [
        createMockLesson({ id: 'lesson-1', recipeId: 'recipe-1' }),
        createMockLesson({ id: 'lesson-2', recipeId: 'recipe-2' }),
      ],
    });
    deps.classService.getClass.mockResolvedValue(mockClass);
    deps.classLessonRepository.findByClassId.mockResolvedValue(mockClass.lessons);
    deps.startRecipeUseCase.execute.mockResolvedValue({ sessionId: 'session-preview-1' });
    deps.orchestrateUseCase.interact.mockResolvedValue({
      voiceText: '¡Hola explorador! Hoy vamos a partir pizzas en mitades.',
      pedagogicalState: 'INTRO',
      meta: { topic: 'fracciones' },
      isRepeat: false,
      lessonProgress: { currentStep: 0, totalSteps: 5 },
      contentSteps: [],
    });

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/class-1/preview');

    // Then
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      sessionId: 'session-preview-1',
      recipeId: 'recipe-1',
      title: 'Mitades y cuartos',
      voiceText: '¡Hola explorador! Hoy vamos a partir pizzas en mitades.',
      pedagogicalState: 'INTRO',
      isRepeat: false,
      lessonProgress: { currentStep: 0, totalSteps: 5 },
    });
    expect(deps.startRecipeUseCase.execute).toHaveBeenCalledWith('recipe-1', 'tutor-1');
    expect(deps.orchestrateUseCase.interact).toHaveBeenCalledWith('session-preview-1', '');
  });

  it('should skip lessons without recipeId and use the first valid one', async () => {
    // Given: first lesson has no recipe, second does
    const mockClass = createMockClass({
      lessons: [
        createMockLesson({ id: 'lesson-1', recipeId: undefined, recipe: undefined }),
        createMockLesson({ id: 'lesson-2', recipeId: 'recipe-2' }),
      ],
    });
    deps.classService.getClass.mockResolvedValue(mockClass);
    deps.classLessonRepository.findByClassId.mockResolvedValue(mockClass.lessons);
    deps.startRecipeUseCase.execute.mockResolvedValue({ sessionId: 'session-2' });
    deps.orchestrateUseCase.interact.mockResolvedValue({
      voiceText: 'hola',
      pedagogicalState: 'INTRO',
      lessonProgress: { currentStep: 0, totalSteps: 1 },
    });

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/class-1/preview');

    // Then
    expect(response.status).toBe(200);
    expect(response.body.recipeId).toBe('recipe-2');
    expect(deps.startRecipeUseCase.execute).toHaveBeenCalledWith('recipe-2', 'tutor-1');
  });

  it('should return 403 when the class is not in DRAFT state', async () => {
    // Given: a published class (preview is a draft-only affordance)
    const mockClass = createMockClass({ status: 'PUBLISHED' });
    deps.classService.getClass.mockResolvedValue(mockClass);

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/class-1/preview');

    // Then
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Preview is only available for classes in DRAFT state');
    expect(deps.startRecipeUseCase.execute).not.toHaveBeenCalled();
  });

  it('should return 403 when the teacher does not own the class (ownership check runs first)', async () => {
    // Given: class owned by another tutor
    const mockClass = createMockClass({ tutorId: 'other-tutor', status: 'PUBLISHED' });
    deps.classService.getClass.mockResolvedValue(mockClass);

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/class-1/preview');

    // Then
    expect(response.status).toBe(403);
    expect(deps.classLessonRepository.findByClassId).not.toHaveBeenCalled();
  });

  it('should return 400 when no lesson has a recipe', async () => {
    // Given: lessons exist but none with recipeId
    const mockClass = createMockClass({
      lessons: [createMockLesson({ recipeId: undefined, recipe: undefined })],
    });
    deps.classService.getClass.mockResolvedValue(mockClass);
    deps.classLessonRepository.findByClassId.mockResolvedValue(mockClass.lessons);

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/class-1/preview');

    // Then
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Class has no valid lessons with recipes');
  });

  it('should map ClassNotFoundError to 404', async () => {
    // Given
    deps.classService.getClass.mockRejectedValue(new ClassNotFoundError('missing'));

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/missing/preview');

    // Then
    expect(response.status).toBe(404);
  });

  it('should map orchestration failures to 500', async () => {
    // Given
    const mockClass = createMockClass({
      lessons: [createMockLesson({ recipeId: 'recipe-1' })],
    });
    deps.classService.getClass.mockResolvedValue(mockClass);
    deps.classLessonRepository.findByClassId.mockResolvedValue(mockClass.lessons);
    deps.startRecipeUseCase.execute.mockResolvedValue({ sessionId: 'session-x' });
    deps.orchestrateUseCase.interact.mockRejectedValue(new Error('orchestrator down'));

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/class-1/preview');

    // Then
    expect(response.status).toBe(500);
  });

  it('should return 401 when unauthenticated', async () => {
    // Given
    const app = createApp(deps, null);

    // When
    const response = await request(app).post('/api/classes/class-1/preview');

    // Then
    expect(response.status).toBe(401);
  });

  it('should return 403 for STUDENT role (preview is tutor-only)', async () => {
    // Given
    const app = createApp(deps, { id: 'student-1', role: 'STUDENT' });

    // When
    const response = await request(app).post('/api/classes/class-1/preview');

    // Then
    expect(response.status).toBe(403);
    expect(deps.classService.getClass).not.toHaveBeenCalled();
  });
});

// ==================== Publish with Age ====================

describe('POST /api/classes/:id/publish', () => {
  let deps: MockDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  it('should persist the age range before publishing and return the published class', async () => {
    // Given: a DRAFT class ready to publish with an explicit audience
    const published = createMockClass({ status: 'PUBLISHED', version: 1 });
    deps.classService.updateClass.mockResolvedValue(published);
    deps.classService.publishClass.mockResolvedValue(published);

    const app = createApp(deps);

    // When
    const response = await request(app)
      .post('/api/classes/class-1/publish')
      .send({ targetAgeMin: 6, targetAgeMax: 8 });

    // Then: ages are persisted through updateClass before publishing
    expect(response.status).toBe(200);
    expect(deps.classService.updateClass).toHaveBeenCalledWith('class-1', 'tutor-1', {
      targetAgeMin: 6,
      targetAgeMax: 8,
    });
    expect(deps.classService.publishClass).toHaveBeenCalledWith('class-1', 'tutor-1');
    expect(response.body.status).toBe('PUBLISHED');
  });

  it('should publish without touching ages when the body is empty', async () => {
    // Given
    const published = createMockClass({ status: 'PUBLISHED', version: 1 });
    deps.classService.publishClass.mockResolvedValue(published);

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/class-1/publish').send({});

    // Then: no age update, plain publish
    expect(response.status).toBe(200);
    expect(deps.classService.updateClass).not.toHaveBeenCalled();
    expect(deps.classService.publishClass).toHaveBeenCalledWith('class-1', 'tutor-1');
  });

  it('should accept only one bound (min only) and persist it', async () => {
    // Given
    const published = createMockClass({ status: 'PUBLISHED', version: 1 });
    deps.classService.updateClass.mockResolvedValue(published);
    deps.classService.publishClass.mockResolvedValue(published);

    const app = createApp(deps);

    // When
    const response = await request(app)
      .post('/api/classes/class-1/publish')
      .send({ targetAgeMin: 5 });

    // Then
    expect(response.status).toBe(200);
    expect(deps.classService.updateClass).toHaveBeenCalledWith('class-1', 'tutor-1', {
      targetAgeMin: 5,
      targetAgeMax: undefined,
    });
  });

  it('should return 400 when targetAgeMin > targetAgeMax', async () => {
    // Given
    const app = createApp(deps);

    // When
    const response = await request(app)
      .post('/api/classes/class-1/publish')
      .send({ targetAgeMin: 10, targetAgeMax: 6 });

    // Then: rejected by schema refinement, nothing executed
    expect(response.status).toBe(400);
    expect(deps.classService.updateClass).not.toHaveBeenCalled();
    expect(deps.classService.publishClass).not.toHaveBeenCalled();
  });

  it('should return 400 when ages are out of the 3-18 range', async () => {
    // Given
    const app = createApp(deps);

    // When
    const response = await request(app)
      .post('/api/classes/class-1/publish')
      .send({ targetAgeMin: 2, targetAgeMax: 8 });

    // Then
    expect(response.status).toBe(400);
    expect(deps.classService.publishClass).not.toHaveBeenCalled();
  });

  it('should propagate ClassValidationError (no lessons) as 400', async () => {
    // Given
    deps.classService.publishClass.mockRejectedValue(
      new ClassValidationError('Class must have at least 1 lesson before publishing'),
    );

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/class-1/publish').send({});

    // Then
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CLASS_VALIDATION_ERROR');
  });

  it('should propagate ClassStateError (already published) as 409', async () => {
    // Given
    deps.classService.publishClass.mockRejectedValue(
      new ClassStateError('class-1', 'Class is already published'),
    );

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/class-1/publish').send({});

    // Then
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CLASS_STATE_ERROR');
  });

  it('should propagate ClassNotFoundError as 404', async () => {
    // Given
    deps.classService.publishClass.mockRejectedValue(new ClassNotFoundError('missing'));

    const app = createApp(deps);

    // When
    const response = await request(app).post('/api/classes/missing/publish').send({});

    // Then
    expect(response.status).toBe(404);
  });

  it('should propagate ClassOwnershipError from updateClass as 403', async () => {
    // Given: non-owner tries to publish with ages — updateClass rejects first
    deps.classService.updateClass.mockRejectedValue(new ClassOwnershipError('class-1', 'tutor-2'));

    const app = createApp(deps, { id: 'tutor-2', role: 'TEACHER' });

    // When
    const response = await request(app)
      .post('/api/classes/class-1/publish')
      .send({ targetAgeMin: 6, targetAgeMax: 8 });

    // Then
    expect(response.status).toBe(403);
    expect(deps.classService.publishClass).not.toHaveBeenCalled();
  });

  it('should return 403 for STUDENT role', async () => {
    // Given
    const app = createApp(deps, { id: 'student-1', role: 'STUDENT' });

    // When
    const response = await request(app).post('/api/classes/class-1/publish').send({});

    // Then
    expect(response.status).toBe(403);
    expect(deps.classService.publishClass).not.toHaveBeenCalled();
  });
});
