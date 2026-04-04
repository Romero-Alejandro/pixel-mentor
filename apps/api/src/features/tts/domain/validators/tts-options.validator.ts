import { z } from 'zod';

// Strict whitelist of allowed TTS hosts (SSRF prevention)
const ALLOWED_TTS_HOSTS = [
  'https://translate.google.com',
  'https://translate.google.co.uk',
  'https://translate.google.co.jp',
  'https://translate.google.de',
  'https://translate.google.fr',
  'https://translate.google.es',
] as const;

export const TTSOptionsSchema = z.object({
  lang: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .default('en'),
  slow: z.boolean().default(false),
  timeout: z.number().int().positive().max(120000).default(60000),
  splitPunct: z.string().max(20).default('.,;!?'),
  // host is NOT exposed to user input - it's set internally only
});

export type ValidatedTTSOptions = z.infer<typeof TTSOptionsSchema>;

/**
 * Validates TTS options and ensures no SSRF vectors.
 * The 'host' parameter is never accepted from user input.
 */
export function validateTTSOptions(input: unknown): ValidatedTTSOptions {
  return TTSOptionsSchema.parse(input);
}

/**
 * Internal TTS host whitelist validation.
 * Only used internally, never exposed to user input.
 */
export function isValidTTSHost(host: string): boolean {
  return ALLOWED_TTS_HOSTS.includes(host as (typeof ALLOWED_TTS_HOSTS)[number]);
}
