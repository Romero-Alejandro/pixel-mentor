import type { AIService } from '@/domain/ports/ai-service';
import type { RecipeRepository } from '@/domain/ports/recipe-repository';
import type { ConceptRepository } from '@/domain/ports/concept-repository';

export interface QuestionAnswerInput {
  recipeId: string;
  question: string;
}

export interface QuestionAnswerOutput {
  answer: string;
  isOnTopic: boolean;
}

const OFF_TOPIC_RESPONSE =
  '¡Buena pregunta! Pero solo puedo responder preguntas sobre la clase de hoy. ¿Quieres preguntarme algo sobre el tema que estamos aprendiendo?';

export class QuestionAnsweringUseCase {
  constructor(
    private recipeRepo: RecipeRepository,
    private conceptRepo: ConceptRepository,
    private aiService: AIService,
  ) {}

  async execute(input: QuestionAnswerInput): Promise<QuestionAnswerOutput> {
    const { recipeId, question } = input;

    // Get recipe for context
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) {
      return {
        answer: 'No encontré información sobre esta lección.',
        isOnTopic: false,
      };
    }

    // Get all concepts for this recipe
    const concepts = await this.conceptRepo.findByRecipeId(recipeId);

    if (concepts.length === 0) {
      return {
        answer: OFF_TOPIC_RESPONSE,
        isOnTopic: false,
      };
    }

    // Build context from concepts
    const context = concepts
      .map((concept) => {
        let text = `CONCEPTO: ${concept.title}\n`;
        text += `EXPLICACIÓN: ${concept.explanation.text}\n`;
        if (concept.examples.length > 0) {
          text += `EJEMPLOS: ${concept.examples.map((e: any) => e.text).join(', ')}\n`;
        }
        if (concept.keyPoints.length > 0) {
          text += `PUNTOS CLAVE: ${concept.keyPoints.join(', ')}\n`;
        }
        return text;
      })
      .join('\n---\n');

    // Generate answer using AI with context
    const aiResponse = await this.aiService.generateAnswer({
      question,
      context,
      recipeTitle: recipe.title,
    });

    return {
      answer: aiResponse.answer,
      isOnTopic: true,
    };
  }
}
