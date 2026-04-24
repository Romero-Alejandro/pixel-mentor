import { PrismaRecipeRepository } from '@/features/recipe/infrastructure/persistence/prisma-recipe.repository.js';
import { PrismaConceptRepository } from '@/features/recipe/infrastructure/persistence/prisma-concept.repository.js';
import { PrismaTagRepository } from '@/features/recipe/infrastructure/persistence/prisma-tag.repository.js';
import { PrismaRecipeTagRepository } from '@/features/recipe/infrastructure/persistence/prisma-recipe-tag.repository.js';
import { FileSystemPromptRepository } from '@/features/recipe/infrastructure/persistence/file-system-prompt.repository.js';
import { PrismaAtomRepository } from '@/features/knowledge/infrastructure/persistence/prisma-atom.repository.js';
import { PrismaSessionRepository } from '@/features/session/infrastructure/persistence/prisma-session.repository.js';
import { PrismaClassLessonRepository } from '@/features/class/infrastructure/persistence/prisma-class-lesson.repository.js';
import { RecipeAIService } from '@/features/recipe/application/services/recipe-ai.service.js';
import { GetRecipeUseCase } from '@/features/recipe/application/use-cases/get-recipe.use-case.js';
import { ListRecipesUseCase } from '@/features/recipe/application/use-cases/list-recipes.use-case.js';
import { StartRecipeUseCase } from '@/features/recipe/application/use-cases/start-recipe.use-case.js';
import { QuestionAnsweringUseCase } from '@/features/recipe/application/use-cases/question-answering.use-case.js';
import { CreateRecipeUseCase } from '@/features/recipe/application/use-cases/create-recipe.use-case.js';
import { UpdateRecipeUseCase } from '@/features/recipe/application/use-cases/update-recipe.use-case.js';
import { DeleteRecipeUseCase } from '@/features/recipe/application/use-cases/delete-recipe.use-case.js';
import { AddStepUseCase } from '@/features/recipe/application/use-cases/add-step.use-case.js';
import { UpdateStepUseCase } from '@/features/recipe/application/use-cases/update-step.use-case.js';
import { DeleteStepUseCase } from '@/features/recipe/application/use-cases/delete-step.use-case.js';
import { ReorderStepsUseCase } from '@/features/recipe/application/use-cases/reorder-steps.use-case.js';
import type { AIService } from '@/features/recipe/domain/ports/ai-service.port.js';
import type { IClassLessonRepository } from '@/features/class/domain/ports/class.repository.port.js';

export interface RecipeContainer {
  recipeRepository: PrismaRecipeRepository;
  conceptRepository: PrismaConceptRepository;
  tagRepository: PrismaTagRepository;
  recipeTagRepository: PrismaRecipeTagRepository;
  promptRepository: FileSystemPromptRepository;
  atomRepository: PrismaAtomRepository;
  sessionRepository: PrismaSessionRepository;
  classLessonRepository: PrismaClassLessonRepository;
  recipeAIService: RecipeAIService;
  getRecipeUseCase: GetRecipeUseCase;
  listRecipesUseCase: ListRecipesUseCase;
  startRecipeUseCase: StartRecipeUseCase;
  questionAnsweringUseCase: QuestionAnsweringUseCase;
  createRecipeUseCase: CreateRecipeUseCase;
  updateRecipeUseCase: UpdateRecipeUseCase;
  deleteRecipeUseCase: DeleteRecipeUseCase;
  addStepUseCase: AddStepUseCase;
  updateStepUseCase: UpdateStepUseCase;
  deleteStepUseCase: DeleteStepUseCase;
  reorderStepsUseCase: ReorderStepsUseCase;
}

export function buildRecipeContainer(aiModel: AIService): RecipeContainer {
  const recipeRepository = new PrismaRecipeRepository();
  const conceptRepository = new PrismaConceptRepository();
  const tagRepository = new PrismaTagRepository();
  const recipeTagRepository = new PrismaRecipeTagRepository();
  const promptRepository = new FileSystemPromptRepository();
  const atomRepository = new PrismaAtomRepository();
  const sessionRepository = new PrismaSessionRepository();
  const classLessonRepository = new PrismaClassLessonRepository();

  const recipeAIService = new RecipeAIService(aiModel);

  return {
    recipeRepository,
    conceptRepository,
    tagRepository,
    recipeTagRepository,
    promptRepository,
    atomRepository,
    sessionRepository,
    classLessonRepository,
    recipeAIService,
    getRecipeUseCase: new GetRecipeUseCase(recipeRepository),
    listRecipesUseCase: new ListRecipesUseCase(recipeRepository),
    startRecipeUseCase: new StartRecipeUseCase(
      recipeRepository,
      sessionRepository,
      classLessonRepository,
    ),
    questionAnsweringUseCase: new QuestionAnsweringUseCase(
      recipeRepository,
      aiModel,
      atomRepository as any,
    ),
    createRecipeUseCase: new CreateRecipeUseCase(recipeRepository, atomRepository),
    updateRecipeUseCase: new UpdateRecipeUseCase(recipeRepository),
    deleteRecipeUseCase: new DeleteRecipeUseCase(recipeRepository),
    addStepUseCase: new AddStepUseCase(recipeRepository, atomRepository),
    updateStepUseCase: new UpdateStepUseCase(recipeRepository, atomRepository),
    deleteStepUseCase: new DeleteStepUseCase(recipeRepository),
    reorderStepsUseCase: new ReorderStepsUseCase(recipeRepository),
  };
}
