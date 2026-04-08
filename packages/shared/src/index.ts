// Re-export all schemas and types from submodules
// Note: We explicitly export from schemas/ to avoid conflicts with legacy exports
export * from './schemas/index.js';
export * from './auth.js';
export * from './gamification/index.js';
// Skip pedagogical.ts, recipe.ts, and session.ts exports to avoid conflicts with schemas/
// The types in those files are still available but not re-exported at root
export * from './types/tts.js';
export * from './keyword-extractor.js';

// Re-export specific items from recipe.ts, pedagogical.ts, and session.ts that aren't in schemas
export { RecipeSchema, RecipeStepSchema, RecipeTagSchema } from './recipe.js';
export type { RecipeStep, RecipeTag, Recipe } from './recipe.js';
export { SessionCheckpointSchema } from './pedagogical.js';
export type { SessionCheckpoint } from './pedagogical.js';
export { SessionSchema, SessionStatusSchema } from './session.js';
export type { SessionStatus, Session } from './session.js';
