/**
 * Class AI Application Service
 *
 * Provides AI-powered features for class creation and improvement.
 */

import type { AIService } from '@/features/recipe/domain/ports/ai-service.port';
import type {
  IClassRepository,
  IClassLessonRepository,
} from '@/features/class/domain/ports/class.repository.port';
import type { ClassEntity as Class } from '@/features/class/domain/entities/class.entity';
import { ClassNotFoundError } from '@/shared/errors';

// DTOs
export interface GenerateClassDraftInput {
  topic: string;
  learningObjectives?: string[];
  targetAudience?: string;
  duration?: number;
  numberOfLessons?: number;
}

export interface GeneratedLesson {
  title: string;
  description?: string;
  duration: number;
  learningObjectives: string[];
  keyTopics: string[];
}

export interface GeneratedClassDraft {
  title: string;
  description: string;
  learningObjectives: string[];
  lessons: GeneratedLesson[];
  suggestedDuration: number;
  qualityValidation?: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface ClassImprovementSuggestion {
  type: 'content' | 'structure' | 'pedagogical' | 'engagement';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestion: string;
}

// AI Service
export class ClassAIService {
  constructor(
    private classRepo: IClassRepository,
    private lessonRepo: IClassLessonRepository,
    private aiService: AIService,
  ) {}

  async generateClassDraft(input: GenerateClassDraftInput): Promise<GeneratedClassDraft> {
    const prompt = this.buildClassGenerationPrompt(input);

    try {
      const response = await this.aiService.generateAnswer({
        question: prompt,
        context: 'You are an expert curriculum designer. Create a structured class with lessons.',
        recipeTitle: 'Class Generation',
      });

      return this.parseAIResponse(response.answer, input);
    } catch {
      return this.generateFallbackDraft(input);
    }
  }

  async suggestImprovements(classId: string): Promise<ClassImprovementSuggestion[]> {
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    const lessons = await this.lessonRepo.findByClassId(classId);
    const suggestions: ClassImprovementSuggestion[] = [];

    if (lessons.length < 3) {
      suggestions.push({
        type: 'structure',
        priority: 'high',
        title: 'Add more lessons',
        description: 'A well-structured class typically has at least 3 lessons to cover topics thoroughly.',
        suggestion: `Consider breaking down your content into ${3 - lessons.length} more lesson(s) to create a more comprehensive learning experience.`,
      });
    }

    if (lessons.length > 1) {
      const hasVariation = lessons.length >= 2;
      if (!hasVariation) {
        suggestions.push({
          type: 'structure',
          priority: 'low',
          title: 'Vary lesson structure',
          description: 'Consider adding more lessons to create a richer learning experience.',
          suggestion: 'Consider varying lesson lengths - some can be shorter introductions while others can be deeper dives.',
        });
      }
    }

    if (!classEntity.description || classEntity.description.length < 50) {
      suggestions.push({
        type: 'content',
        priority: 'medium',
        title: 'Enhance class description',
        description: 'A good description helps students understand what they will learn.',
        suggestion: 'Add a detailed description (at least 100 characters) explaining the class outcomes and what students will gain.',
      });
    }

    if (classEntity.status === 'PUBLISHED') {
      suggestions.push({
        type: 'pedagogical',
        priority: 'low',
        title: 'Consider creating a new version',
        description: 'Published classes can be updated by creating new versions.',
        suggestion: 'If content needs updates, consider creating a new version to maintain version history.',
      });
    }

    if (lessons.length >= 3) {
      const aiSuggestion = await this.generateAIImprovements(classEntity);
      if (aiSuggestion) {
        suggestions.push(aiSuggestion);
      }
    }

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return suggestions;
  }

  private buildClassGenerationPrompt(input: GenerateClassDraftInput): string {
    const objectives = input.learningObjectives?.join(', ') || 'Not specified';
    const audience = input.targetAudience || 'General learners';
    const lessons = input.numberOfLessons || 3;
    const duration = input.duration || 60;

    return `Create a class structure for the topic: "${input.topic}"

Learning objectives: ${objectives}
Target audience: ${audience}
Total duration: ${duration} minutes
Number of lessons: ${lessons}

For each lesson, provide:
- title
- duration in minutes
- 2-3 learning objectives
- key topics to cover

Return the response as a structured JSON that can be parsed.`;
  }

  private parseAIResponse(aiResponse: string, input: GenerateClassDraftInput): GeneratedClassDraft {
    try {
      const parsed = JSON.parse(aiResponse);
      return {
        title: parsed.title || `Introduction to ${input.topic}`,
        description: parsed.description || `Learn about ${input.topic}`,
        learningObjectives: parsed.learningObjectives || input.learningObjectives || [],
        lessons: parsed.lessons || this.generateDefaultLessons(input),
        suggestedDuration: parsed.suggestedDuration || input.duration || 60,
        qualityValidation: parsed.qualityValidation || {
          passed: true,
          errors: [],
          warnings: [],
        },
      };
    } catch {
      return this.generateFallbackDraft(input);
    }
  }

  private generateFallbackDraft(input: GenerateClassDraftInput): GeneratedClassDraft {
    return {
      title: `Introduction to ${input.topic}`,
      description: `A comprehensive class covering the fundamentals of ${input.topic}`,
      learningObjectives: input.learningObjectives || [
        `Understand the basics of ${input.topic}`,
        'Apply knowledge to real-world scenarios',
        'Build foundational skills in the subject',
      ],
      lessons: this.generateDefaultLessons(input),
      suggestedDuration: input.duration || 60,
      qualityValidation: {
        passed: true,
        errors: [],
        warnings: ['Using fallback template due to AI service unavailability'],
      },
    };
  }

  private generateDefaultLessons(input: GenerateClassDraftInput): GeneratedLesson[] {
    const lessons = input.numberOfLessons || 3;
    const durationPerLesson = Math.floor((input.duration || 60) / lessons);

    const lessonTitles = [
      'Introduction and Fundamentals',
      'Core Concepts and Theory',
      'Practical Applications',
      'Advanced Topics',
      'Review and Practice',
    ];

    const result: GeneratedLesson[] = [];
    for (let i = 0; i < lessons; i++) {
      result.push({
        title: lessonTitles[i] || `Lesson ${i + 1}`,
        description: `Part ${i + 1} of the ${input.topic} course`,
        duration: durationPerLesson,
        learningObjectives: [
          `Understand key concepts in section ${i + 1}`,
          'Apply learned concepts',
        ],
        keyTopics: [`Topic ${i + 1}.1`, `Topic ${i + 1}.2`],
      });
    }

    return result;
  }

  private async generateAIImprovements(
    classEntity: Class,
  ): Promise<ClassImprovementSuggestion | null> {
    try {
      const prompt = `Analyze this class structure and suggest ONE specific improvement:
Class: ${classEntity.title}
Description: ${classEntity.description || 'Not provided'}

Provide a single suggestion in JSON format:
{
  "type": "content|structure|pedagogical|engagement",
  "priority": "high|medium|low",
  "title": "short title",
  "description": "what the issue is",
  "suggestion": "how to fix it"
}`;

      const response = await this.aiService.generateAnswer({
        question: prompt,
        context: 'You are an expert educational designer.',
        recipeTitle: 'Class Improvement',
      });

      try {
        const parsed = JSON.parse(response.answer);
        return {
          type: parsed.type || 'pedagogical',
          priority: parsed.priority || 'medium',
          title: parsed.title || 'Consider improvements',
          description: parsed.description || '',
          suggestion: parsed.suggestion || '',
        };
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }
}
