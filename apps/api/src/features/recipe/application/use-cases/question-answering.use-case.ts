import type { RecipeRepository } from '@/features/recipe/domain/ports/recipe.repository.port';
import { RecipeNotFoundError } from '@/features/recipe/domain/ports/recipe.repository.port';
import type { AIService } from '@/features/recipe/domain/ports/ai-service.port';
import type { RAGService } from '@/features/recipe/domain/ports/rag-service.port';

export class QuestionAnsweringUseCase {
  constructor(
    private recipeRepo: RecipeRepository,
    private aiService: AIService,
    private ragService?: RAGService,
  ) {}

  async execute(params: { recipeId: string; question: string }) {
    const recipe = await this.recipeRepo.findById(params.recipeId);
    if (!recipe) throw new RecipeNotFoundError(params.recipeId);

    let ragContext = '';
    if (this.ragService) {
      const chunks = await this.ragService.retrieveChunks({
        atomId: recipe.id,
        queryText: params.question,
        k: 3,
      });
      ragContext = chunks.chunks.map((c: { chunk: { chunkText: string } }) => c.chunk.chunkText).join('\n');
    }

    const response = await this.aiService.generateAnswer({
      question: params.question,
      context: ragContext,
      recipeTitle: recipe.title,
    });

    return {
      answer: response.answer,
    };
  }
}
