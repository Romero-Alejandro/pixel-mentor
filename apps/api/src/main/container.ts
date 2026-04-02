import type pino from 'pino';

import { buildAuthContainer } from '@/features/auth/infrastructure/di/auth.container.js';
import { buildRecipeContainer } from '@/features/recipe/infrastructure/di/recipe.container.js';
import { buildSessionContainer } from '@/features/session/infrastructure/di/session.container.js';
import { buildActivityContainer } from '@/features/activity/infrastructure/di/activity.container.js';
import { buildProgressContainer } from '@/features/progress/infrastructure/di/progress.container.js';
import { buildKnowledgeContainer } from '@/features/knowledge/infrastructure/di/knowledge.container.js';
import { buildGamificationContainer } from '@/features/gamification/infrastructure/di/gamification.container.js';
import { buildClassContainer } from '@/features/class/infrastructure/di/class.container.js';
import { buildEvaluationContainer } from '@/features/evaluation/infrastructure/di/evaluation.container.js';
import { buildTTSContainer } from '@/features/tts/infrastructure/di/tts.container.js';
import { buildPromptContainer } from '@/features/prompt/infrastructure/di/prompt.container.js';

import type { Config } from '@/shared/config/index.js';

/**
 * Main application container that composes all feature containers.
 *
 * This is the main entry point for dependency injection. Each feature
 * has its own container that is built and composed here.
 */
export function buildContainer(config: Config, logger: pino.Logger) {
  // Build all feature containers
  const auth = buildAuthContainer(logger);
  const recipe = buildRecipeContainer(config, logger);
  const session = buildSessionContainer(logger);
  const activity = buildActivityContainer(logger);
  const progress = buildProgressContainer(logger);
  const knowledge = buildKnowledgeContainer(logger);
  const gamification = buildGamificationContainer(
    logger,
    progress.progressRepository,
    activity.activityAttemptRepository,
  );
  const classContainer = buildClassContainer(config, logger);
  const evaluation = buildEvaluationContainer(config, logger);
  const tts = buildTTSContainer(config, logger);
  const prompt = buildPromptContainer(logger);

  // Return composed container with all feature containers
  return {
    auth,
    recipe,
    session,
    activity,
    progress,
    knowledge,
    gamification,
    class: classContainer,
    evaluation,
    tts,
    prompt,
  };
}

// Re-export all container interfaces for type safety
export type { AuthContainer } from '@/features/auth/infrastructure/di/auth.container.js';
export type { RecipeContainer } from '@/features/recipe/infrastructure/di/recipe.container.js';
export type { SessionContainer } from '@/features/session/infrastructure/di/session.container.js';
export type { ActivityContainer } from '@/features/activity/infrastructure/di/activity.container.js';
export type { ProgressContainer } from '@/features/progress/infrastructure/di/progress.container.js';
export type { KnowledgeContainer } from '@/features/knowledge/infrastructure/di/knowledge.container.js';
export type { GamificationContainer } from '@/features/gamification/infrastructure/di/gamification.container.js';
export type { ClassContainer } from '@/features/class/infrastructure/di/class.container.js';
export type { EvaluationContainer } from '@/features/evaluation/infrastructure/di/evaluation.container.js';
export type { TTSContainer } from '@/features/tts/infrastructure/di/tts.container.js';
export type { PromptContainer } from '@/features/prompt/infrastructure/di/prompt.container.js';
