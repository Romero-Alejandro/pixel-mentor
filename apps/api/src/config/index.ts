import { z } from 'zod';
import 'dotenv/config';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().min(1),
  GEMINI_API_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().url().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_MAX_INTERACT: z.coerce.number().int().positive().default(5),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
});

export type Config = z.infer<typeof envSchema>;

let config: Config;
try {
  config = envSchema.parse(process.env);
} catch (error) {
  console.error('Invalid environment configuration:', error);
  throw error;
}

export { config };
