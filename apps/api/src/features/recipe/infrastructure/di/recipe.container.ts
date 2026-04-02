import type pino from 'pino';
import type { Config } from '@/shared/config/index.js';

import { PrismaRecipeRepository } from '@/features/recipe/infrastructure/persistence/prisma-recipe.repository.js';
import { PrismaConceptRepository } from '@/features/recipe/infrastructure/persistence/prisma-concept.repository.js';
import { PrismaTagRepository } from '@/features/recipe/infrastructure/persistence/prisma-tag.repository.js';
import { PrismaRecipeTagRepository } from '@/features/recipe/infrastructure/persistence/prisma-recipe-tag.repository.js';
import { FileSystemPromptRepository } from '@/features/recipe/infrastructure/persistence/file-system-prompt.repository.js';
import { RecipeService } from '@/features/recipe/application/services/recipe.service.js';
import { RecipeAIService } from '@/features/recipe/application/services/recipe-ai.service.js';
import { GetRecipeUseCase } from '@/features/recipe/application/use-cases/get-recipe.use-case.js';
import { ListRecipesUseCase } from '@/features/recipe/application/use-cases/list-recipes.use-case.js';
import { StartRecipeUseCase } from '@/features/recipe/application/use-cases/start-recipe.use-case.js';
import { QuestionAnsweringUseCase } from '@/features/recipe/application/use-cases/question-answering.use-case.js';
import { AIAdapterFactory } from '@/shared/ai/ai-adapter-factory.js';

export interface RecipeContainer {
  recipeRepository: PrismaRecipeRepository;
  conceptRepository: PrismaConceptRepository;
  tagRepository: PrismaTagRepository;
  recipeTagRepository: PrismaRecipeTagRepository;
  promptRepository: FileSystemPromptRepository;
  recipeService: RecipeService;
  recipeAIService: RecipeAIService;
  getRecipeUseCase: GetRecipeUseCase;
  listRecipesUseCase: ListRecipesUseCase;
  startRecipeUseCase: StartRecipeUseCase;
  questionAnsweringUseCase: QuestionAnsweringUseCase;
}

export function buildRecipeContainer(config: Config, logger: pino.Logger): RecipeContainer {
  const recipeRepository = new PrismaRecipeRepository();
  const conceptRepository = new PrismaConceptRepository();
  const tagRepository = new PrismaTagRepository();
  const recipeTagRepository = new PrismaRecipeTagRepository();
  const promptRepository = new FileSystemPromptRepository();

  const aiProvider = AIAdapterFactory.createResilient({
    provider: config.LLM_PROVIDER,
    geminiApiKey: config.GEMINI_API_KEY,
    openRouterApiKey: config.OPENROUTER_API_KEY,
    groqApiKey: config.GROQ_API_KEY,
    defaultModelOpenRouter: config.DEFAULT_MODEL_OPENROUTER,
    defaultModelGemini: config.DEFAULT_MODEL_GEMINI,
    defaultModelGroq: config.DEFAULT_MODEL_GROQ,
    promptRepo: promptRepository,
    knowledgeChunkRepository: null as any, // Will be injected from knowledge container
    logger,
  });

  const recipeService = new RecipeService(recipeRepository, null as any);
  const recipeAIService = new RecipeAIService(aiProvider.aiModel);

  return {
    recipeRepository,
    conceptRepository,
    tagRepository,
    recipeTagRepository,
    promptRepository,
    recipeService,
    recipeAIService,
    getRecipeUseCase: new GetRecipeUseCase(recipeRepository),
    listRecipesUseCase: new ListRecipesUseCase(recipeRepository),
    startRecipeUseCase: new StartRecipeUseCase(recipeRepository, null as any),
    questionAnsweringUseCase: new QuestionAnsweringUseCase(
      recipeRepository,
      null as any,
      aiProvider.aiModel as any,
    ),
  };
}
