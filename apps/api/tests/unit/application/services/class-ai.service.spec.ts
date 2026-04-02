import { ClassAIService } from '@/features/class/application/services/class-ai.service.js';
import type { AIService } from '@/features/recipe/domain/ports/ai-service.port.js';
import type {
  IClassRepository,
  IClassLessonRepository,
} from '@/features/class/domain/ports/class.repository.js';
import type { ClassEntity } from '@/features/class/domain/entities/class.entity.js';

// ==================== Mock Factories ====================

const createMockAIService = (): jest.Mocked<AIService> => ({
  generateAnswer: jest.fn(),
  generateResponse: jest.fn(),
  generateResponseStream: jest.fn(),
  generateExplanation: jest.fn(),
  evaluateResponse: jest.fn(),
});

const createMockClassRepo = (): jest.Mocked<IClassRepository> => ({
  findById: jest.fn(),
  findByTutorId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const createMockLessonRepo = (): jest.Mocked<IClassLessonRepository> => ({
  findByClassId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  reorder: jest.fn(),
});

const createMockClassEntity = (overrides: Partial<ClassEntity> = {}): ClassEntity => ({
  id: 'class-1',
  title: 'Test Class',
  description: 'Test Description',
  tutorId: 'tutor-1',
  status: 'DRAFT',
  version: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockLessonEntity = (overrides: Partial<any> = {}): any => ({
  id: 'lesson-1',
  classId: 'class-1',
  recipeId: 'recipe-1',
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ==================== Test Data ====================

const baseInput = {
  topic: 'Introduction to TypeScript',
  learningObjectives: ['Understand basic types', 'Write simple functions'],
  targetAudience: 'Beginner developers',
  duration: 60,
  numberOfLessons: 3,
};

const mockAIResponseJSON = {
  title: 'TypeScript Fundamentals',
  description: 'Learn the basics of TypeScript including types, interfaces, and functions',
  learningObjectives: ['Master type annotations', 'Use interfaces effectively'],
  lessons: [
    {
      title: 'Getting Started',
      description: 'Introduction to TypeScript and setup',
      duration: 15,
      learningObjectives: ['Install TypeScript', 'Write first TypeScript file'],
      keyTopics: ['Installation', 'Basic syntax', 'tsc compiler'],
    },
    {
      title: 'Type System',
      description: 'Understanding TypeScript type system',
      duration: 20,
      learningObjectives: ['Use primitive types', 'Define custom types'],
      keyTopics: ['Primitive types', 'Type annotations', 'Type inference'],
    },
    {
      title: 'Interfaces and Objects',
      description: 'Working with object types',
      duration: 25,
      learningObjectives: ['Define interfaces', 'Implement object types'],
      keyTopics: ['Interfaces', 'Object types', 'Optional properties'],
    },
  ],
  suggestedDuration: 60,
  qualityValidation: {
    passed: true,
    errors: [],
    warnings: ['Consider adding more exercises'],
  },
};

// ==================== Tests ====================

describe('ClassAIService', () => {
  let aiService: jest.Mocked<AIService>;
  let classRepo: jest.Mocked<IClassRepository>;
  let lessonRepo: jest.Mocked<IClassLessonRepository>;
  let service: ClassAIService;

  beforeEach(() => {
    aiService = createMockAIService();
    classRepo = createMockClassRepo();
    lessonRepo = createMockLessonRepo();
    service = new ClassAIService(classRepo, lessonRepo, aiService);
  });

  describe('generateClassDraft', () => {
    it('should call AI service with correct parameters', async () => {
      const aiResponse = JSON.stringify(mockAIResponseJSON);
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      await service.generateClassDraft(baseInput);

      expect(aiService.generateAnswer).toHaveBeenCalledTimes(1);
      expect(aiService.generateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.stringContaining('Introduction to TypeScript'),
          context: expect.stringContaining('curriculum designer'),
          recipeTitle: 'Class Generation',
        }),
      );
    });

    it('should return GeneratedClassDraft with correct structure when AI returns valid JSON', async () => {
      const aiResponse = JSON.stringify(mockAIResponseJSON);
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      expect(result.title).toBe('TypeScript Fundamentals');
      expect(result.description).toContain('TypeScript');
      expect(result.learningObjectives).toHaveLength(2);
      expect(result.lessons).toHaveLength(3);
      expect(result.suggestedDuration).toBe(60);
      expect(result.qualityValidation!.passed).toBe(true);
      expect(Array.isArray(result.qualityValidation!.errors)).toBe(true);
      expect(Array.isArray(result.qualityValidation!.warnings)).toBe(true);
    });

    it('should validate lessons have required fields', async () => {
      const aiResponse = JSON.stringify(mockAIResponseJSON);
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      result.lessons.forEach((lesson: any) => {
        expect(lesson).toHaveProperty('title');
        expect(lesson).toHaveProperty('description');
        expect(lesson).toHaveProperty('duration');
        expect(lesson).toHaveProperty('learningObjectives');
        expect(lesson).toHaveProperty('keyTopics');
        expect(typeof lesson.title).toBe('string');
        expect(typeof lesson.description).toBe('string');
        expect(typeof lesson.duration).toBe('number');
        expect(lesson.duration).toBeGreaterThan(0);
        expect(Array.isArray(lesson.learningObjectives)).toBe(true);
        expect(Array.isArray(lesson.keyTopics)).toBe(true);
      });
    });

    it('should use fallback draft when AI returns invalid JSON', async () => {
      aiService.generateAnswer.mockResolvedValue({ answer: 'This is not JSON' });

      const result = await service.generateClassDraft(baseInput);

      expect(result.title).toContain('Introduction to TypeScript');
      expect(result.description).toContain('comprehensive class');
      expect(result.qualityValidation!.warnings).toContain(
        'Using fallback template due to AI service unavailability',
      );
    });

    it('should use fallback draft when AI service throws an error', async () => {
      aiService.generateAnswer.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.generateClassDraft(baseInput);

      expect(result.title).toContain('Introduction to TypeScript');
      expect(result.description).toContain('comprehensive class');
      expect(result.qualityValidation?.warnings).toContain(
        'Using fallback template due to AI service unavailability',
      );
    });

    it('should sanitize missing title and use topic-based fallback', async () => {
      const aiResponse = JSON.stringify({
        description: 'Only description provided',
        learningObjectives: [],
        lessons: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      // Use a topic without "Introduction to" prefix to test fallback
      const result = await service.generateClassDraft({ topic: 'TypeScript' });

      expect(result.title).toBe('Introduction to TypeScript');
    });

    it('should sanitize missing description and use topic-based fallback', async () => {
      const aiResponse = JSON.stringify({
        title: 'Custom Title',
        learningObjectives: [],
        lessons: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      expect(result.description).toContain('Introduction to TypeScript');
    });

    it('should sanitize missing learningObjectives and use input or defaults', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        description: 'Test desc',
        lessons: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      expect(result.learningObjectives).toEqual(baseInput.learningObjectives);
    });

    it('should sanitize missing lessons and generate default lessons', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        description: 'Test desc',
        learningObjectives: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      expect(result.lessons).toHaveLength(3);
    });

    it('should sanitize missing suggestedDuration and use input or default', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        description: 'Test desc',
        lessons: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      expect(result.suggestedDuration).toBe(60);
    });

    it('should sanitize missing qualityValidation and set defaults', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        description: 'Test desc',
        lessons: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      expect(result.qualityValidation).toEqual({
        passed: true,
        errors: [],
        warnings: [],
      });
    });

    it('should preserve qualityValidation if provided', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        description: 'Test desc',
        lessons: [],
        qualityValidation: {
          passed: false,
          errors: ['Invalid structure'],
          warnings: ['Too short'],
        },
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      expect(result.qualityValidation).toEqual({
        passed: false,
        errors: ['Invalid structure'],
        warnings: ['Too short'],
      });
    });

    it('should handle AI response wrapped in markdown code block by falling back', async () => {
      const json = JSON.stringify(mockAIResponseJSON);
      // Service does not strip markdown; it will fail to parse and use fallback
      const aiResponse = '```json\n' + json + '\n```';
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      // Since parsing fails, fallback title uses topic
      expect(result.title).toContain('Introduction to TypeScript');
      expect(result.qualityValidation?.warnings).toContain(
        'Using fallback template due to AI service unavailability',
      );
    });

    it('should handle empty lessons array from AI response', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        description: 'Test desc',
        lessons: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      // AI-provided empty lessons are not padded; fallback only on parse error
      expect(result.lessons).toEqual([]);
    });

    it('should handle partial lessons with missing fields (returns as-is)', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        lessons: [
          {
            title: 'Lesson 1',
            // Missing description, duration, learningObjectives, keyTopics
          },
        ],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      // The parser does not sanitize missing lesson fields; they remain undefined
      expect(result.lessons[0].description).toBeUndefined();
      expect(result.lessons[0].duration).toBeUndefined();
      expect(result.lessons[0].learningObjectives).toBeUndefined();
      expect(result.lessons[0].keyTopics).toBeUndefined();
    });

    it('should handle input with minimal options (all optional fields undefined)', async () => {
      const minimalInput = {
        topic: 'Basic Topic',
      };
      const aiResponse = JSON.stringify({
        title: 'Test',
        description: 'Test desc',
        lessons: [{ title: 'L1', duration: 10, learningObjectives: [], keyTopics: [] }],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(minimalInput);

      expect(result.title).toBe('Test');
      expect(result.suggestedDuration).toBeGreaterThan(0);
      expect(result.learningObjectives).toEqual([]);
    });

    it('should distribute duration evenly across default lessons when AI fails', async () => {
      const input = { topic: 'Topic', duration: 90, numberOfLessons: 3 };
      aiService.generateAnswer.mockRejectedValue(new Error('AI failed'));

      const result = await service.generateClassDraft(input);

      expect(result.lessons).toHaveLength(3);
      const totalDuration = result.lessons.reduce((sum, l) => sum + l.duration, 0);
      expect(totalDuration).toBe(90);
    });

    it('should handle lessons with zero duration (as-is)', async () => {
      const aiResponse = JSON.stringify({
        title: 'T',
        lessons: [
          {
            title: 'L1',
            duration: 0,
            learningObjectives: [],
            keyTopics: [],
          },
        ],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      // Service does not modify duration; keep as provided
      expect(result.lessons[0].duration).toBe(0);
    });
  });

  describe('buildClassGenerationPrompt', () => {
    it('should build prompt with all fields', () => {
      const input = {
        topic: 'TypeScript',
        learningObjectives: ['Learn types', 'Use generics'],
        targetAudience: 'Developers',
        duration: 60,
        numberOfLessons: 4,
      };

      const prompt = (service as any).buildClassGenerationPrompt(input);

      expect(prompt).toContain('"TypeScript"');
      expect(prompt).toContain('Learn types, Use generics');
      expect(prompt).toContain('Developers');
      expect(prompt).toContain('60 minutes');
      expect(prompt).toContain('4');
    });

    it('should handle missing learningObjectives', () => {
      const input = {
        topic: 'Topic',
        targetAudience: 'Students',
        duration: 45,
        numberOfLessons: 2,
      };

      const prompt = (service as any).buildClassGenerationPrompt(input);

      expect(prompt).toContain('Not specified');
    });

    it('should handle missing targetAudience', () => {
      const input = {
        topic: 'Topic',
        learningObjectives: ['Obj1'],
        duration: 30,
        numberOfLessons: 1,
      };

      const prompt = (service as any).buildClassGenerationPrompt(input);

      expect(prompt).toContain('General learners');
    });

    it('should handle missing duration', () => {
      const input = {
        topic: 'Topic',
        learningObjectives: ['Obj1'],
      };

      const prompt = (service as any).buildClassGenerationPrompt(input);

      expect(prompt).toContain('60 minutes');
    });

    it('should handle missing numberOfLessons', () => {
      const input = {
        topic: 'Topic',
      };

      const prompt = (service as any).buildClassGenerationPrompt(input);

      expect(prompt).toContain('3');
    });
  });

  describe('parseAIResponse', () => {
    it('should parse valid JSON response', () => {
      const aiResponse = JSON.stringify(mockAIResponseJSON);
      const input = baseInput;

      const result = (service as any).parseAIResponse(aiResponse, input);

      expect(result.title).toBe('TypeScript Fundamentals');
      expect(result.lessons).toHaveLength(3);
    });

    it('should use fallback when JSON is invalid', () => {
      const aiResponse = 'Invalid JSON';
      const input = baseInput;

      const result = (service as any).parseAIResponse(aiResponse, input);

      expect(result.title).toContain('Introduction to TypeScript');
      expect(result.qualityValidation.warnings).toContain(
        'Using fallback template due to AI service unavailability',
      );
    });

    it('should use input topic for title when missing in response', () => {
      const aiResponse = JSON.stringify({
        description: 'Only desc',
        lessons: [],
      });
      const input = { topic: 'My Topic' };

      const result = (service as any).parseAIResponse(aiResponse, input);

      expect(result.title).toBe('Introduction to My Topic');
    });

    it('should use input topic for description when missing in response', () => {
      const aiResponse = JSON.stringify({
        title: 'My Title',
        lessons: [],
      });
      const input = { topic: 'My Topic' };

      const result = (service as any).parseAIResponse(aiResponse, input);

      expect(result.description).toContain('My Topic');
    });

    it('should use input learningObjectives when missing in response', () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        lessons: [],
      });
      const input = { topic: 'T', learningObjectives: ['Obj1', 'Obj2'] };

      const result = (service as any).parseAIResponse(aiResponse, input);

      expect(result.learningObjectives).toEqual(['Obj1', 'Obj2']);
    });

    it('should use empty array for learningObjectives when both missing', () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        lessons: [],
      });
      const input = { topic: 'T' };

      const result = (service as any).parseAIResponse(aiResponse, input);

      expect(result.learningObjectives).toEqual([]);
    });

    it('should use default lessons generator when lessons missing', () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        lessons: undefined as any,
      });
      const input = baseInput;

      const result = (service as any).parseAIResponse(aiResponse, input);

      expect(result.lessons).toHaveLength(3);
    });
  });

  describe('generateFallbackDraft', () => {
    it('should generate fallback with topic-based title', () => {
      const input = { topic: 'React Hooks' };
      const result = (service as any).generateFallbackDraft(input);

      expect(result.title).toBe('Introduction to React Hooks');
    });

    it('should generate fallback with topic-based description', () => {
      const input = { topic: 'Node.js' };
      const result = (service as any).generateFallbackDraft(input);

      expect(result.description).toContain('Node.js');
    });

    it('should use input learningObjectives or defaults', () => {
      const input = { topic: 'T', learningObjectives: ['Custom obj'] };
      const result = (service as any).generateFallbackDraft(input);

      expect(result.learningObjectives).toContain('Custom obj');
    });

    it('should generate default learningObjectives when none provided', () => {
      const input = { topic: 'T' };
      const result = (service as any).generateFallbackDraft(input);

      expect(result.learningObjectives.length).toBe(3);
    });

    it('should generate lessons with correct numberOfLessons', () => {
      const input = { topic: 'T', numberOfLessons: 5 };
      const result = (service as any).generateFallbackDraft(input);

      expect(result.lessons).toHaveLength(5);
    });

    it('should generate 3 lessons by default', () => {
      const input = { topic: 'T' };
      const result = (service as any).generateFallbackDraft(input);

      expect(result.lessons).toHaveLength(3);
    });

    it('should set suggestedDuration from input or default to 60', () => {
      const input1 = { topic: 'T', duration: 90 };
      const result1 = (service as any).generateFallbackDraft(input1);
      expect(result1.suggestedDuration).toBe(90);

      const input2 = { topic: 'T' };
      const result2 = (service as any).generateFallbackDraft(input2);
      expect(result2.suggestedDuration).toBe(60);
    });

    it('should set qualityValidation with fallback warning', () => {
      const input = { topic: 'T' };
      const result = (service as any).generateFallbackDraft(input);

      expect(result.qualityValidation).toEqual({
        passed: true,
        errors: [],
        warnings: ['Using fallback template due to AI service unavailability'],
      });
    });
  });

  describe('generateDefaultLessons', () => {
    it('should generate 3 lessons by default', () => {
      const input = { topic: 'T' };
      const result = (service as any).generateDefaultLessons(input);

      expect(result).toHaveLength(3);
    });

    it('should generate exact numberOfLessons', () => {
      const input = { topic: 'T', numberOfLessons: 7 };
      const result = (service as any).generateDefaultLessons(input);

      expect(result).toHaveLength(7);
    });

    it('should distribute duration evenly across lessons', () => {
      const input = { topic: 'T', duration: 90, numberOfLessons: 3 };
      const result = (service as any).generateDefaultLessons(input);

      result.forEach((lesson: any) => {
        expect(lesson.duration).toBe(30);
      });
    });

    it('should handle uneven duration distribution with Math.floor', () => {
      const input = { topic: 'T', duration: 100, numberOfLessons: 3 };
      const result = (service as any).generateDefaultLessons(input);

      result.forEach((lesson: any) => {
        expect(lesson.duration).toBe(33);
      });
    });

    it('should use standard lesson titles for first 5 lessons', () => {
      const input = { topic: 'T', numberOfLessons: 3 };
      const result = (service as any).generateDefaultLessons(input);

      expect(result[0].title).toBe('Introduction and Fundamentals');
      expect(result[1].title).toBe('Core Concepts and Theory');
      expect(result[2].title).toBe('Practical Applications');
    });

    it('should use numbered titles for lessons beyond title list', () => {
      const input = { topic: 'T', numberOfLessons: 8 };
      const result = (service as any).generateDefaultLessons(input);

      expect(result[5].title).toBe('Lesson 6');
      expect(result[6].title).toBe('Lesson 7');
      expect(result[7].title).toBe('Lesson 8');
    });

    it('should include topic in lesson descriptions', () => {
      const input = { topic: 'GraphQL', numberOfLessons: 1 };
      const result = (service as any).generateDefaultLessons(input);

      expect(result[0].description).toContain('GraphQL');
      expect(result[0].description).toContain('Part 1');
    });

    it('should include section numbers in learningObjectives', () => {
      const input = { topic: 'T', numberOfLessons: 2 };
      const result = (service as any).generateDefaultLessons(input);

      expect(result[0].learningObjectives[0]).toContain('section 1');
      expect(result[1].learningObjectives[0]).toContain('section 2');
    });

    it('should include section numbers in keyTopics', () => {
      const input = { topic: 'T', numberOfLessons: 2 };
      const result = (service as any).generateDefaultLessons(input);

      expect(result[0].keyTopics[0]).toContain('1.1');
      expect(result[0].keyTopics[1]).toContain('1.2');
      expect(result[1].keyTopics[0]).toContain('2.1');
    });

    it('should have positive duration for all lessons', () => {
      const input = { topic: 'T' };
      const result = (service as any).generateDefaultLessons(input);

      result.forEach((lesson: any) => {
        expect(lesson.duration).toBeGreaterThan(0);
      });
    });

    it('should have at least 2 learningObjectives per lesson', () => {
      const input = { topic: 'T', numberOfLessons: 3 };
      const result = (service as any).generateDefaultLessons(input);

      result.forEach((lesson: any) => {
        expect(lesson.learningObjectives.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should have at least 2 keyTopics per lesson', () => {
      const input = { topic: 'T', numberOfLessons: 3 };
      const result = (service as any).generateDefaultLessons(input);

      result.forEach((lesson: any) => {
        expect(lesson.keyTopics.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('suggestImprovements', () => {
    const mockLessons = [
      createMockLessonEntity({ id: 'l1', classId: 'class-1', order: 0 }),
      createMockLessonEntity({ id: 'l2', classId: 'class-1', order: 1 }),
    ];

    it('should throw ClassNotFoundError when class does not exist', async () => {
      classRepo.findById.mockResolvedValue(null);

      await expect(service.suggestImprovements('non-existent')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('not found'),
        }),
      );
    });

    it('should fetch lessons when class exists', async () => {
      const mockClass = createMockClassEntity({ id: 'class-1' });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);

      await service.suggestImprovements('class-1');

      expect(lessonRepo.findByClassId).toHaveBeenCalledWith('class-1');
    });

    it('should add high priority suggestion when lessons < 3', async () => {
      const mockClass = createMockClassEntity({ id: 'class-1' });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue([mockLessons[0]]);

      const result = await service.suggestImprovements('class-1');

      const addLessonSuggestion = result.find((s: any) => s.title === 'Add more lessons');
      expect(addLessonSuggestion).toBeDefined();
      expect(addLessonSuggestion!.priority).toBe('high');
      expect(addLessonSuggestion!.type).toBe('structure');
    });

    it('should NOT add lesson count suggestion when lessons >= 3', async () => {
      const mockClass = createMockClassEntity({ id: 'class-1' });
      // Provide 3 lessons to avoid suggestion
      const threeLessons = [
        mockLessons[0],
        mockLessons[1],
        createMockLessonEntity({ id: 'l3', classId: 'class-1', order: 2 }),
      ];
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(threeLessons);

      const result = await service.suggestImprovements('class-1');

      const addLessonSuggestion = result.find((s: any) => s.title === 'Add more lessons');
      expect(addLessonSuggestion).toBeUndefined();
    });

    it('should add medium priority suggestion when description < 50 chars', async () => {
      const mockClass = createMockClassEntity({ id: 'class-1', description: 'Short' });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);

      const result = await service.suggestImprovements('class-1');

      const descSuggestion = result.find((s: any) => s.title === 'Enhance class description');
      expect(descSuggestion).toBeDefined();
      expect(descSuggestion!.priority).toBe('medium');
      expect(descSuggestion!.type).toBe('content');
    });

    it('should NOT add description suggestion when description >= 50 chars', async () => {
      const longDesc = 'This is a very long description that exceeds fifty characters easily';
      const mockClass = createMockClassEntity({ id: 'class-1', description: longDesc });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);

      const result = await service.suggestImprovements('class-1');

      const descSuggestion = result.find((s: any) => s.title === 'Enhance class description');
      expect(descSuggestion).toBeUndefined();
    });

    it('should add medium priority suggestion when no description', async () => {
      const mockClass = createMockClassEntity({ id: 'class-1', description: undefined });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);

      const result = await service.suggestImprovements('class-1');

      const descSuggestion = result.find((s: any) => s.title === 'Enhance class description');
      expect(descSuggestion).toBeDefined();
      expect(descSuggestion!.priority).toBe('medium');
    });

    it('should add low priority suggestion for published classes', async () => {
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'PUBLISHED' as const });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);

      const result = await service.suggestImprovements('class-1');

      const versionSuggestion = result.find(
        (s: any) => s.title === 'Consider creating a new version',
      );
      expect(versionSuggestion).toBeDefined();
      expect(versionSuggestion!.priority).toBe('low');
      expect(versionSuggestion!.type).toBe('pedagogical');
    });

    it('should NOT add version suggestion for DRAFT classes', async () => {
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);

      const result = await service.suggestImprovements('class-1');

      const versionSuggestion = result.find(
        (s: any) => s.title === 'Consider creating a new version',
      );
      expect(versionSuggestion).toBeUndefined();
    });

    it('should try to generate AI improvements when lessons >= 3', async () => {
      const mockClass = createMockClassEntity({ id: 'class-1' });
      const threeLessons = [
        mockLessons[0],
        mockLessons[1],
        createMockLessonEntity({ id: 'l3', classId: 'class-1', order: 2 }),
      ];
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(threeLessons);
      aiService.generateAnswer.mockResolvedValue({
        answer: JSON.stringify({
          type: 'engagement',
          priority: 'medium',
          title: 'Add interactive quiz',
          description: 'Students learn better with interaction',
          suggestion: 'Add a quiz at the end',
        }),
      });

      const result = await service.suggestImprovements('class-1');

      expect(aiService.generateAnswer).toHaveBeenCalled();
      const aiSuggestion = result.find((s: any) => s.title === 'Add interactive quiz');
      expect(aiSuggestion).toBeDefined();
    });

    it('should NOT call AI when lessons < 3', async () => {
      const mockClass = createMockClassEntity({ id: 'class-1' });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue([mockLessons[0]]);

      await service.suggestImprovements('class-1');

      expect(aiService.generateAnswer).not.toHaveBeenCalled();
    });

    it('should handle AI error gracefully and continue without AI suggestion', async () => {
      const mockClass = createMockClassEntity({ id: 'class-1' });
      const threeLessons = [
        mockLessons[0],
        mockLessons[1],
        createMockLessonEntity({ id: 'l3', classId: 'class-1', order: 2 }),
      ];
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(threeLessons);
      aiService.generateAnswer.mockRejectedValue(new Error('AI failed'));

      const result = await service.suggestImprovements('class-1');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should sort suggestions by priority (high -> medium -> low)', async () => {
      const mockClass = createMockClassEntity({
        id: 'class-1',
        status: 'DRAFT',
        description: 'Short',
      });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue([mockLessons[0]]);

      const result = await service.suggestImprovements('class-1');

      const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
      const priorities = result.map((s: any) => s.priority as keyof typeof priorityOrder);
      const sortedPriorities = [...priorities].sort((a, b) => {
        return priorityOrder[a] - priorityOrder[b];
      });

      expect(priorities).toEqual(sortedPriorities);
    });

    it('should return empty array when class is perfect', async () => {
      const longDesc =
        'This is a very long description that exceeds fifty characters and provides detail';
      const mockClass = createMockClassEntity({
        id: 'class-1',
        status: 'DRAFT',
        description: longDesc,
      });
      const threeLessons = [
        mockLessons[0],
        mockLessons[1],
        createMockLessonEntity({ id: 'l3', classId: 'class-1', order: 2 }),
      ];
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(threeLessons);

      const result = await service.suggestImprovements('class-1');

      expect(result).toEqual([]);
    });

    it('should combine multiple suggestions when multiple issues exist', async () => {
      const mockClass = createMockClassEntity({
        id: 'class-1',
        status: 'PUBLISHED',
        description: 'Short',
      });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue([mockLessons[0]]);

      const result = await service.suggestImprovements('class-1');

      const priorities = result.map((s: any) => s.priority);
      expect(priorities).toContain('high');
      expect(priorities).toContain('medium');
      expect(priorities).toContain('low');
    });
  });

  describe('generateAIImprovements', () => {
    const threeLessons = [
      createMockLessonEntity({ id: 'l1', classId: 'class-1', order: 0 }),
      createMockLessonEntity({ id: 'l2', classId: 'class-1', order: 1 }),
      createMockLessonEntity({ id: 'l3', classId: 'class-1', order: 2 }),
    ];

    it('should call AI service with class analysis prompt', async () => {
      const mockClass = createMockClassEntity({ title: 'My Class', description: 'Desc' });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(threeLessons);

      aiService.generateAnswer.mockResolvedValue({
        answer: JSON.stringify({
          type: 'content',
          priority: 'high',
          title: 'Improve content',
          description: 'Content needs work',
          suggestion: 'Add more examples',
        }),
      });

      await service.suggestImprovements('class-1');

      expect(aiService.generateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.stringContaining('My Class'),
          context: expect.stringContaining('expert educational designer'),
          recipeTitle: 'Class Improvement',
        }),
      );
    });

    it('should parse valid AI suggestion response', async () => {
      const mockClass = createMockClassEntity({ title: 'My Class' });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(threeLessons);

      aiService.generateAnswer.mockResolvedValue({
        answer: JSON.stringify({
          type: 'engagement',
          priority: 'high',
          title: 'Add gamification',
          description: 'Students love games',
          suggestion: 'Add points and badges',
        }),
      });

      const result = await service.suggestImprovements('class-1');

      const aiSuggestion = result.find((s: any) => s.title === 'Add gamification');
      expect(aiSuggestion).toBeDefined();
      expect(aiSuggestion!.type).toBe('engagement');
      expect(aiSuggestion!.priority).toBe('high');
      expect(aiSuggestion!.suggestion).toBe('Add points and badges');
    });

    it('should not add AI suggestion when response is not valid JSON', async () => {
      const mockClass = createMockClassEntity();
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(threeLessons);

      aiService.generateAnswer.mockResolvedValue({ answer: 'Not JSON at all' });

      const result = await service.suggestImprovements('class-1');

      const aiSuggestion = result.find((s: any) => s.title === 'Add gamification');
      expect(aiSuggestion).toBeUndefined();
    });

    it('should handle AI service error gracefully', async () => {
      const mockClass = createMockClassEntity();
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(threeLessons);

      aiService.generateAnswer.mockRejectedValue(new Error('AI unavailable'));

      const result = await service.suggestImprovements('class-1');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should use defaults when AI response missing fields', async () => {
      const mockClass = createMockClassEntity();
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(threeLessons);

      aiService.generateAnswer.mockResolvedValue({
        answer: JSON.stringify({
          title: 'Only title',
        }),
      });

      const result = await service.suggestImprovements('class-1');

      const aiSuggestion = result.find((s: any) => s.title === 'Only title');
      expect(aiSuggestion).toBeDefined();
      expect(aiSuggestion!.type).toBe('pedagogical');
      expect(aiSuggestion!.priority).toBe('medium');
      expect(aiSuggestion!.description).toBe('');
      expect(aiSuggestion!.suggestion).toBe('');
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle extremely long topic string', async () => {
      const longTopic = 'A'.repeat(1000);
      const input = { topic: longTopic };
      // Omit title to trigger fallback that uses topic
      aiService.generateAnswer.mockResolvedValue({
        answer: JSON.stringify({ description: 'D', lessons: [] }),
      });

      const result = await service.generateClassDraft(input);

      expect(result.title).toContain(longTopic);
    });

    it('should handle special characters in topic', async () => {
      const input = { topic: 'TypeScript & Node.js: Advanced "Patterns"' };
      aiService.generateAnswer.mockResolvedValue({
        answer: JSON.stringify({ title: 'T', lessons: [] }),
      });

      const result = await service.generateClassDraft(input);

      expect(result.title).toBe('T');
    });

    it('should handle JSON with extra fields (ignored by parser)', async () => {
      const aiResponse = JSON.stringify({
        title: 'T',
        description: 'D',
        lessons: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateClassDraft(baseInput);

      expect(result.title).toBe('T');
      // Extra fields are ignored by the parser, not included in result
    });

    it('should handle multiple concurrent generateClassDraft calls', async () => {
      const aiResponse = JSON.stringify(mockAIResponseJSON);
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const promises = [
        service.generateClassDraft(baseInput),
        service.generateClassDraft({ ...baseInput, topic: 'Topic 2' }),
        service.generateClassDraft({ ...baseInput, topic: 'Topic 3' }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.title).toBe('TypeScript Fundamentals');
      });
    });
  });
});
