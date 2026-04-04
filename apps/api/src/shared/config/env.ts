import { createLogger } from '@/shared/logger/logger.js';
import { z } from 'zod';
import 'dotenv/config';

// Create a minimal pino logger for startup (before DI is available)
const startupLogger = createLogger(undefined, { name: 'startup', level: 'error' });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('production'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().min(1),
  LLM_PROVIDER: z.enum(['gemini', 'openrouter', 'groq']).default('groq'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  DEFAULT_MODEL_GEMINI: z.string().default('gemini-2.5-flash-lite'),
  DEFAULT_MODEL_OPENROUTER: z.string().default('stepfun/step-3.5-flash:free'),
  DEFAULT_MODEL_GROQ: z.string().default('llama-3.3-70b-versatile'),
  TTS_PROVIDER: z.enum(['google-free', 'mock']).default('google-free'),
  JWT_SECRET: z.string().min(1).default('change-me-in-development'),
  CORS_ORIGIN: z.string().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_MAX_INTERACT: z.coerce.number().int().positive().default(5),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  ENABLE_STREAMING: z.coerce.boolean().default(false),
  USE_NEW_EVALUATOR_ENGINE: z.coerce.boolean().default(false),

  // LLM Governance - Cost protection and security
  LLM_MAX_PROMPT_LENGTH: z.coerce.number().int().positive().default(16000),
  LLM_MAX_USER_INPUT_LENGTH: z.coerce.number().int().positive().default(2000),
  LLM_DEFAULT_USER_QUOTA: z.coerce.number().int().nonnegative().default(100),
  LLM_DAILY_BUDGET_USD: z.coerce.number().positive().default(10),
  LLM_MAX_REQUESTS_PER_USER_PER_HOUR: z.coerce.number().int().positive().default(60),

  // OpenRouter metadata
  OPENROUTER_APP_URL: z.string().url().default('http://localhost:3001'),
  OPENROUTER_APP_NAME: z.string().default('Pixel Mentor'),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    startupLogger.error({ err: errorMessage }, 'Invalid environment configuration');
    process.exit(1);
  }
}

export const config = loadConfig();
